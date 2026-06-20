<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue';
import { useDroneStore } from '../store/drone';
import type { FlightEvent, FlightEventType } from '../types';

const store = useDroneStore();
const timelineContainer = ref<HTMLElement>();

const eventIcons: Record<FlightEventType, string> = {
  takeoff: '🛫',
  waypoint_reached: '📍',
  action_start: '▶️',
  action_end: '✅',
  landing: '🛬',
  warning: '⚠️',
  info: 'ℹ️',
};

const eventColors: Record<FlightEventType, string> = {
  takeoff: 'text-green-400',
  waypoint_reached: 'text-sky-400',
  action_start: 'text-amber-400',
  action_end: 'text-emerald-400',
  landing: 'text-rose-400',
  warning: 'text-orange-400',
  info: 'text-slate-400',
};

const eventBgColors: Record<FlightEventType, string> = {
  takeoff: 'bg-green-500/20 border-green-500/40',
  waypoint_reached: 'bg-sky-500/20 border-sky-500/40',
  action_start: 'bg-amber-500/20 border-amber-500/40',
  action_end: 'bg-emerald-500/20 border-emerald-500/40',
  landing: 'bg-rose-500/20 border-rose-500/40',
  warning: 'bg-orange-500/20 border-orange-500/40',
  info: 'bg-slate-500/20 border-slate-500/40',
};

function formatTime(timestamp: number): string {
  const d = new Date(timestamp);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  const s = d.getSeconds().toString().padStart(2, '0');
  const ms = d.getMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${ms}`;
}

function formatElapsed(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}m ${s}s`;
}

const elapsedTime = computed(() => {
  if (store.flightEvents.length === 0) return '0.0s';
  const first = store.flightEvents[0].timestamp;
  const last = store.flightEvents[store.flightEvents.length - 1].timestamp;
  return formatElapsed((last - first) / 1000);
});

watch(
  () => store.flightEvents.length,
  () => {
    nextTick(() => {
      if (timelineContainer.value) {
        timelineContainer.value.scrollTop = timelineContainer.value.scrollHeight;
      }
    });
  }
);
</script>

<template>
  <div class="bg-slate-800 rounded-lg p-3 flex flex-col">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-bold text-slate-200">
        🕐 飞行时间轴
      </h3>
      <div class="text-[10px] text-slate-500">
        共 {{ store.flightEvents.length }} 条记录
      </div>
    </div>

    <div
      v-if="store.flightEvents.length > 0"
      class="text-[10px] text-slate-400 mb-2 bg-slate-900 rounded px-2 py-1 flex justify-between"
    >
      <span>飞行时长: {{ elapsedTime }}</span>
      <span>当前航点: WP{{ store.currentWaypointIndex + 1 || '-' }}</span>
    </div>

    <div
      v-if="store.flightEvents.length === 0"
      class="text-center text-slate-500 text-xs py-6"
    >
      <div class="text-2xl mb-1">⏳</div>
      <div>暂无飞行记录</div>
      <div class="text-[10px] mt-1">开始模拟飞行后将显示事件时间轴</div>
    </div>

    <div
      v-else
      ref="timelineContainer"
      class="relative space-y-1 overflow-y-auto max-h-[280px] pr-1"
    >
      <div
        v-for="(event, idx) in store.flightEvents"
        :key="event.id"
        class="relative pl-6"
      >
        <div
          class="absolute left-2 top-2 w-0.5 h-full bg-slate-700"
          v-if="idx < store.flightEvents.length - 1"
        />

        <div
          :class="[
            'absolute left-0 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px]',
            eventBgColors[event.type],
            'border',
          ]"
        >
          <span class="text-[10px]">{{ eventIcons[event.type] }}</span>
        </div>

        <div
          :class="[
            'bg-slate-900/60 rounded px-2 py-1.5 text-xs ml-1',
            'border border-transparent',
            store.currentWaypointIndex === event.waypointIndex && store.isSimulating
              ? 'border-sky-500/50 bg-sky-900/20'
              : '',
          ]"
        >
          <div class="flex items-center justify-between">
            <span :class="['font-medium', eventColors[event.type]]">
              {{ event.message }}
            </span>
            <span class="text-[10px] text-slate-500 font-mono">
              {{ formatTime(event.timestamp) }}
            </span>
          </div>
          <div
            v-if="event.waypointIndex !== undefined"
            class="text-[10px] text-slate-500 mt-0.5"
          >
            航点 WP{{ event.waypointIndex + 1 }}
            <span v-if="event.altitude !== undefined">
              · 高度 {{ event.altitude }}m
            </span>
          </div>
          <div v-if="event.details" class="text-[10px] text-slate-500 mt-0.5">
            {{ event.details }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: #1e293b;
  border-radius: 2px;
}
::-webkit-scrollbar-thumb {
  background: #475569;
  border-radius: 2px;
}
::-webkit-scrollbar-thumb:hover {
  background: #64748b;
}
</style>
