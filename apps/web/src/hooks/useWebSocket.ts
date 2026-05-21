import { useEffect, useRef, useState } from 'react';
import { useProjectStore } from '../store/projectStore';
import { useAgentStore } from '../store/agentStore';
import type { DeploymentStep } from '../types';

// ANSI terminal color codes
const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // In local standalone mode we won't connect successfully, so we mock connection
    setIsConnected(true);

    // Heartbeat metrics ticker simulation
    const interval = setInterval(() => {
      useAgentStore.getState().tickMetrics();
    }, 4000);

    const currentSocket = socketRef.current;

    return () => {
      clearInterval(interval);
      if (currentSocket) {
        currentSocket.close();
      }
    };
  }, []);

  // Simulates a live deployment pipeline run
  const runDeploymentSimulation = (
    deploymentId: string,
    onLine: (line: string) => void,
    onStepChange?: () => void
  ) => {
    let active = true;
    const projectStore = useProjectStore.getState();
    const deployment = projectStore.deployments.find((d) => d.id === deploymentId);
    
    if (!deployment) return () => {};

    // Check if the deployment is already finished
    if (deployment.status === 'success' || deployment.status === 'failed') {
      // Re-play existing logs instantly
      const playLogs = async () => {
        for (const step of deployment.steps) {
          if (!active) return;
          onLine(`${C.bold}${C.cyan}--- Step: ${step.name} ---${C.reset}\r\n`);
          for (const line of step.logs) {
            onLine(`${line}\r\n`);
          }
          onLine('\r\n');
        }
      };
      playLogs();
      return () => { active = false; };
    }

    // Set deployment to running
    projectStore.updateDeployment(deploymentId, { status: 'running' });

    // Deployment steps configuration
    const stepsData = [
      {
        name: 'Git Checkout',
        duration: 3000,
        logs: [
          () => `${C.gray}[SYSTEM]${C.reset} Initializing runner: us-east-runner-01`,
          () => `${C.gray}[SYSTEM]${C.reset} Cleaning workspace...`,
          () => `${C.blue}git init${C.reset}`,
          () => `Initialized empty Git repository in /workspace/project/.git/`,
          () => `${C.blue}git remote add origin ${deployment.projectName}.git${C.reset}`,
          () => `${C.blue}git fetch --depth=1 origin ${deployment.commitHash}${C.reset}`,
          () => `From github.com/infra-cd/${deployment.projectName}`,
          () => ` * branch            ${deployment.commitHash} -> FETCH_HEAD`,
          () => `${C.blue}git checkout -q FETCH_HEAD${C.reset}`,
          () => `${C.bold}${C.green}✓${C.reset} HEAD is now at ${C.bold}${deployment.commitHash}${C.reset} - ${deployment.commitMessage}`,
          () => `Author: ${deployment.commitAuthor}`,
          () => `${C.gray}[SYSTEM]${C.reset} Git clone completed successfully.`
        ]
      },
      {
        name: 'Lint & Audit',
        duration: 5000,
        logs: [
          () => `${C.gray}[SYSTEM]${C.reset} Initiating source code analysis...`,
          () => `${C.blue}npm run lint${C.reset}`,
          () => `${C.dim}> eslint src --max-warnings=0${C.reset}`,
          () => `Parsing typescript config...`,
          () => `Analyzing 14 code paths...`,
          () => `  src/components/ui/button.tsx - ${C.green}Clean${C.reset}`,
          () => `  src/store/projectStore.ts - ${C.yellow}Warning: Unused import 'AxiosResponse' on line 4${C.reset}`,
          () => `  src/pages/Dashboard.tsx - ${C.green}Clean${C.reset}`,
          () => `Scan complete: 0 errors, 1 warning (0 build-blocking errors).`,
          () => `${C.blue}npm run audit${C.reset}`,
          () => `Checking database vulnerabilities against registry...`,
          () => `${C.bold}${C.green}✓${C.reset} 0 vulnerabilities found in 412 packages.`
        ]
      },
      {
        name: 'Docker Build & Push',
        duration: 8000,
        logs: [
          () => `${C.gray}[SYSTEM]${C.reset} Starting container image compilation...`,
          () => `${C.blue}docker build -t registry.infra-cd.internal/${deployment.projectName}:latest .${C.reset}`,
          () => `Sending build context to Docker daemon  42.5MB`,
          () => `Step 1/9 : FROM node:20-alpine AS base`,
          () => ` ---> f39120de8402`,
          () => `Step 2/9 : WORKDIR /app`,
          () => ` ---> Using cache`,
          () => ` ---> bd831fa2bc4d`,
          () => `Step 3/9 : COPY package*.json ./`,
          () => ` ---> c1a2bc44321e`,
          () => `Step 4/9 : RUN npm ci --only=production`,
          () => ` ---> Running in a2c83b10cc31`,
          () => `${C.dim}added 324 packages in 4.12s${C.reset}`,
          () => ` ---> Removing intermediate container a2c83b10cc31`,
          () => ` ---> 512bda24c9ea`,
          () => `Step 5/9 : COPY . .`,
          () => ` ---> 2d8acb3f491c`,
          () => `Step 6/9 : RUN npm run build`,
          () => ` ---> Running in f32bb410cc02`,
          () => `${C.magenta}Vite v5.2.10 compiling assets...${C.reset}`,
          () => `✓ 812 modules transformed.`,
          () => `dist/assets/index-c41b8a1.js  312.18 kB`,
          () => `dist/assets/index-c41b8a1.css  42.10 kB`,
          () => `HTML compilation finished.`,
          () => ` ---> Removing intermediate container f32bb410cc02`,
          () => ` ---> a412bc42de77`,
          () => `Step 7/9 : EXPOSE 3000`,
          () => ` ---> Running in c182bc4028cc`,
          () => ` ---> 81fa2c30ba4d`,
          () => `Step 8/9 : CMD ["node", "dist/index.js"]`,
          () => ` ---> 28d49a71b3cf`,
          () => `Successfully built 28d49a71b3cf`,
          () => `Successfully tagged registry.infra-cd.internal/${deployment.projectName}:latest`,
          () => `${C.blue}docker push registry.infra-cd.internal/${deployment.projectName}:latest${C.reset}`,
          () => `The push refers to repository [registry.infra-cd.internal/${deployment.projectName}]`,
          () => `5f70bf18a086: Pushed`,
          () => `c0e9b21f3922: Pushed`,
          () => `latest: digest: sha256:4f3c02eb92a188fba812de81c2010cf0c4b2a1a8c size: 948`
        ]
      },
      {
        name: 'Deploy Container',
        duration: 5000,
        logs: [
          () => `${C.gray}[SYSTEM]${C.reset} Preparing deployment rollout...`,
          () => `${C.blue}kubectl apply -f k8s/deployment.yaml${C.reset}`,
          () => `deployment.apps/${deployment.projectName} configured`,
          () => `service/${deployment.projectName}-service configured`,
          () => `${C.gray}[SYSTEM]${C.reset} Watching container deployment rollout...`,
          () => `Waiting for pod rollout: 0 of 2 updated replicas are available...`,
          () => `Pod 1 [${deployment.projectName}-8c44b9b-ab12]: ContainerCreated`,
          () => `Pod 1 [${deployment.projectName}-8c44b9b-ab12]: Running`,
          () => `Pod 2 [${deployment.projectName}-8c44b9b-cd34]: ContainerCreated`,
          () => `Pod 2 [${deployment.projectName}-8c44b9b-cd34]: Running`,
          () => `Running ingress routing and endpoint healthchecks...`,
          () => `${C.cyan}GET /health - 200 OK (8ms)${C.reset}`,
          () => `${C.bold}${C.green}✓ Deployment Successful! Service is fully routed and online.${C.reset}`
        ]
      }
    ];

    // Determine if deployment should fail (to showcase failure UX)
    // We make payment-worker deployments fail on compile/build step
    const shouldFail = deployment.projectName.includes('payment') || Math.random() < 0.15;
    const failStepIndex = shouldFail ? 2 : -1; // Fail at compilation/build step

    let currentStepIdx = 0;
    let stepStartTime = Date.now();

    const executeSteps = async () => {
      // Copy default steps structure
      const steps: DeploymentStep[] = deployment.steps.map((s) => ({
        ...s,
        status: 'pending',
        logs: [],
        startedAt: undefined,
        completedAt: undefined,
        durationSeconds: 0
      }));

      // Initialize all steps in store
      projectStore.updateDeployment(deploymentId, { steps });

      while (currentStepIdx < stepsData.length && active) {
        const stepData = stepsData[currentStepIdx];
        const isFailingStep = currentStepIdx === failStepIndex;

        // Start step
        stepStartTime = Date.now();
        steps[currentStepIdx] = {
          ...steps[currentStepIdx],
          status: 'running',
          startedAt: new Date().toISOString()
        };
        projectStore.updateDeployment(deploymentId, { steps: [...steps] });
        if (onStepChange) onStepChange();

        onLine(`${C.bold}${C.cyan}--- Step: ${stepData.name} ---${C.reset}\r\n`);

        // Stream logs line by line
        const logsList = stepData.logs;
        const lineInterval = stepData.duration / logsList.length;

        for (let i = 0; i < logsList.length; i++) {
          if (!active) return;
          const logLine = logsList[i]();
          
          // Append line to internal step logs
          steps[currentStepIdx].logs.push(logLine);
          projectStore.updateDeployment(deploymentId, { steps: [...steps] });

          // Print line to terminal
          onLine(`${logLine}\r\n`);
          
          await new Promise((resolve) => setTimeout(resolve, lineInterval));
        }

        const duration = Math.round((Date.now() - stepStartTime) / 1000);

        if (isFailingStep) {
          // Trigger failure
          onLine('\r\n');
          onLine(`${C.bold}${C.red}❌ Error: Build compilation aborted due to critical error.${C.reset}\r\n`);
          onLine(`${C.red}Exit Code: 1${C.reset}\r\n`);

          steps[currentStepIdx] = {
            ...steps[currentStepIdx],
            status: 'failed',
            completedAt: new Date().toISOString(),
            durationSeconds: duration
          };
          
          // Set rest of steps to failed/skipped
          for (let j = currentStepIdx + 1; j < steps.length; j++) {
            steps[j].status = 'pending';
          }

          projectStore.updateDeployment(deploymentId, {
            status: 'failed',
            completedAt: new Date().toISOString(),
            durationSeconds: Math.round((Date.now() - new Date(deployment.startedAt).getTime()) / 1000),
            steps: [...steps]
          });
          
          if (onStepChange) onStepChange();
          return;
        }

        // Complete step successfully
        steps[currentStepIdx] = {
          ...steps[currentStepIdx],
          status: 'success',
          completedAt: new Date().toISOString(),
          durationSeconds: duration
        };
        projectStore.updateDeployment(deploymentId, { steps: [...steps] });
        onLine('\r\n');

        currentStepIdx++;
      }

      // Complete deployment successfully
      if (active) {
        projectStore.updateDeployment(deploymentId, {
          status: 'success',
          completedAt: new Date().toISOString(),
          durationSeconds: Math.round((Date.now() - new Date(deployment.startedAt).getTime()) / 1000)
        });
        if (onStepChange) onStepChange();
      }
    };

    executeSteps();

    return () => {
      active = false;
    };
  };

  return {
    isConnected,
    runDeploymentSimulation
  };
};
export type TUseWebSocket = ReturnType<typeof useWebSocket>;
export default useWebSocket;
