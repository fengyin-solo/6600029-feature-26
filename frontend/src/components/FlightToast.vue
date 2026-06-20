<script setup lang="ts">
import { ref, watch } from 'vue';
import { useDroneStore } from '../store/drone';
import type { FlightEvent, FlightEventType } from '../types';

const store = useDroneStore();

interface ToastItem {
  id: string;
  event: FlightEvent;
  visible: boolean;
}

const toasts = ref<ToastItem[]>([]);

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
  takeoff: 'from-green-600 to-green-700 border-green-500',
  waypoint_reached: 'from-sky-600 to-sky-700 border-sky-500',
  action_start: 'from-amber-600 to-amber-700 border-amber-500',
  action_end: 'from-emerald-600 to-emerald-700 border-emerald-500',
  landing: 'from-rose-600 to-rose-700 border-rose-500',
  warning: 'from-orange-600 to-orange-700 border-orange-500',
  info: 'from-slate-600 to-slate-700 border-slate-500',
};

function showToast(event: FlightEvent) {
  const toast: ToastItem = {
    id: event.id,
    event,
    visible: true,
  };
  toasts.value.push(toast);

  setTimeout(() => {
    const idx = toasts.value.findIndex((t) => t.id === event.id);
    if (idx !== -1) {
      toasts.value[idx].visible = false;
      setTimeout(() => {
        toasts.value = toasts.value.filter((t) => t.id !== event.id);
      }, 300);
    }
  }, 3000);
}

let lastEventId: string | null = null;

watch(
  () => store.flightEvents.length,
  () => {
    const events = store.flightEvents;
    if (events.length === 0) {
      lastEventId = null;
      return;
    }
    const latestEvent = events[events.length - 1];
    if (latestEvent.id !== lastEventId) {
      lastEventId = latestEvent.id;
      showToast(latestEvent);
    }
  }
);
</script>

<template>
  <div class="fixed top-16 right-4 z-[2000] flex flex-col gap-2 pointer-events-none">
    <TransitionGroup name="toast">
      <div
        v-for="toast in toasts"
        :key="toast.id"
        :class="[
          'min-w-[240px] max-w-[320px] rounded-lg shadow-xl',
          'bg-gradient-to-r border-l-4',
          'text-white text-sm',
          'transform transition-all duration-300',
          'pointer-events-auto',
          eventColors[toast.event.type],
          toast.visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full',
        ]"
      >
        <div class="p-3">
          <div class="flex items-center gap-2">
            <span class="text-lg">{{ eventIcons[toast.event.type] }}</span>
            <span class="font-semibold">{{ toast.event.message }}</span>
          </div>
          <div
            v-if="toast.event.waypointIndex !== undefined"
            class="text-xs text-white/70 mt-1"
          >
            航点 WP{{ toast.event.waypointIndex + 1 }}
            <span v-if="toast.event.altitude !== undefined">
              · 高度 {{ toast.event.altitude }}m
            </span>
          </div>
          <div v-if="toast.event.details" class="text-xs text-white/70 mt-1">
            {{ toast.event.details }}
          </div>
        </div>
      </div>
    </TransitionGroup>
  </div>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(100%);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(100%);
}
.toast-move {
  transition: transform 0.3s ease;
}
</style>
