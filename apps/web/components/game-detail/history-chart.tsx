"use client";

import { LineChart } from "echarts/charts";
import { GridComponent, TooltipComponent } from "echarts/components";
import * as echarts from "echarts/core";
import { SVGRenderer } from "echarts/renderers";
import { useEffect, useRef } from "react";

import type { SeriesPoint } from "@/lib/games/view-model";

echarts.use([LineChart, GridComponent, TooltipComponent, SVGRenderer]);

// Chart ink mirrors the CSS tokens; ECharts cannot read CSS variables.
const INK = { series: "#8b93ff", axis: "#8a9099", grid: "#1f2328", tooltipBg: "#0e1013", tooltipBorder: "#2a2f36", text: "#e6e8eb" };

interface HistoryChartProps {
  points: SeriesPoint[];
  /** Short name used in the tooltip, e.g. "Ratings". */
  label: string;
  /** Rank charts put position 1 at the top. */
  invert?: boolean;
  decimals?: number;
}

/**
 * Stored snapshots are change-only, so values are drawn as steps: a flat run means
 * "no change observed", never an interpolated estimate.
 */
export function HistoryChart({ points, label, invert = false, decimals = 0 }: HistoryChartProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const chart = echarts.init(element, null, { renderer: "svg" });
    const format = (value: number) =>
      value.toLocaleString("en-US", { maximumFractionDigits: decimals, minimumFractionDigits: decimals });

    chart.setOption({
      animation: false,
      grid: { left: 8, right: 16, top: 12, bottom: 8, containLabel: true },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: INK.grid } },
        axisTick: { show: false },
        axisLabel: { color: INK.axis, fontSize: 11, hideOverlap: true },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        inverse: invert,
        scale: true,
        minInterval: decimals === 0 ? 1 : undefined,
        axisLabel: { color: INK.axis, fontSize: 11, formatter: (v: number) => format(v) },
        splitLine: { lineStyle: { color: INK.grid, width: 1 } },
      },
      tooltip: {
        trigger: "axis",
        axisPointer: { type: "line", lineStyle: { color: INK.axis } },
        backgroundColor: INK.tooltipBg,
        borderColor: INK.tooltipBorder,
        textStyle: { color: INK.text, fontSize: 12 },
        valueFormatter: (value: unknown) => (typeof value === "number" ? format(value) : "—"),
      },
      series: [
        {
          name: label,
          type: "line",
          step: "end",
          showSymbol: true,
          symbolSize: 8,
          itemStyle: { color: INK.series, borderColor: "#101215", borderWidth: 2 },
          lineStyle: { width: 2, color: INK.series, cap: "round", join: "round" },
          areaStyle: invert ? undefined : { color: INK.series, opacity: 0.1 },
          data: points.map((point) => [point.at, point.value]),
        },
      ],
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [points, label, invert, decimals]);

  // The chart is decorative for assistive tech; the summary and the observation table carry the data.
  return <div ref={ref} aria-hidden className="h-56 w-full" />;
}
