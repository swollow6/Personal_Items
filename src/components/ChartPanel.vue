<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { init, use, type EChartsType } from 'echarts/core'
import { BarChart, PieChart } from 'echarts/charts'
import { TooltipComponent, GridComponent, LegendComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import EmptyState from './EmptyState.vue'
const props = defineProps<{
  title: string
  labels?: string[]
  values?: number[]
  pie?: { name: string; value: number }[]
  unit: string
}>()
use([BarChart, PieChart, TooltipComponent, GridComponent, LegendComponent, CanvasRenderer])
const element = ref<HTMLElement>(),
  ready = ref(false)
let chart: EChartsType | undefined,
  observer: ResizeObserver | undefined,
  gone = false
const hasData = () =>
  props.pie ? props.pie.some((p) => p.value > 0) : props.values?.some((v) => v > 0)
async function draw() {
  await nextTick()
  if (!ready.value || !element.value || !hasData()) {
    chart?.dispose()
    chart = undefined
    return
  }
  if (gone) return
  chart ??= init(element.value)
  chart.setOption(
    {
      color: ['#47765b', '#a4b697', '#d5bc8c', '#9aa8b4', '#b8918c', '#c6cdb8'],
      textStyle: { fontFamily: 'inherit' },
      tooltip: { trigger: props.pie ? 'item' : 'axis', renderMode: 'richText' },
      ...(props.pie
        ? {
            legend: { bottom: 0, icon: 'circle' },
            series: [
              {
                type: 'pie',
                radius: ['48%', '70%'],
                center: ['50%', '44%'],
                data: props.pie,
                label: { show: false },
                itemStyle: { borderRadius: 5, borderWidth: 3, borderColor: '#fff' },
              },
            ],
          }
        : {
            grid: { top: 28, left: 50, right: 12, bottom: 32 },
            xAxis: {
              type: 'category',
              data: props.labels?.map((m) => m.slice(5) + '月'),
              axisTick: { show: false },
              axisLine: { show: false },
            },
            yAxis: {
              type: 'value',
              name: props.unit,
              minInterval: 1,
              splitLine: { lineStyle: { color: '#f0f2ed' } },
            },
            series: [
              {
                type: 'bar',
                data: props.values,
                barMaxWidth: 32,
                itemStyle: { borderRadius: [5, 5, 0, 0] },
              },
            ],
          }),
    },
    true
  )
  chart.resize()
}
onMounted(() => {
  ready.value = true
  void draw()
  observer = new ResizeObserver(() => chart?.resize())
  if (element.value) observer.observe(element.value)
})
watch(
  () => [props.values, props.pie, props.labels],
  () => {
    void draw()
  },
  { deep: true }
)
onBeforeUnmount(() => {
  gone = true
  observer?.disconnect()
  chart?.dispose()
})
</script>
<template>
  <section class="panel chart-panel">
    <div class="section-heading">
      <h2>{{ title }}</h2>
      <span class="small muted">{{ unit }}</span>
    </div>
    <div
      v-show="hasData()"
      ref="element"
      class="chart"
      role="img"
      :aria-label="`${title}，单位：${unit}`"
    />
    <details v-if="hasData()" class="chart-data">
      <summary>查看数据</summary>
      <ul>
        <li v-for="(value, index) in pie ?? values" :key="index">
          {{ pie ? pie[index]?.name : labels?.[index] }}：{{
            typeof value === 'number' ? value : value.value
          }}
          {{ unit }}
        </li>
      </ul>
    </details>
    <EmptyState
      v-else
      title="暂时还没有数据"
      description="开始记录后，这里会呈现你的使用与购置趋势。"
      icon="stats"
      compact
    />
  </section>
</template>
