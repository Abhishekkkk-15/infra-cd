package main
import (
	"fmt"
	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/mem"
)
func main() {
	percentages, err := cpu.Percent(0, false)
	fmt.Printf("CPU Percent: %v, error: %v\n", percentages, err)
	v, err := mem.VirtualMemory()
	if v != nil {
		fmt.Printf("RAM Percent: %v\n", v.UsedPercent)
	}
}
