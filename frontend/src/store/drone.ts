import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Waypoint, NoFlyZone, TerrainPoint, FlightPlan, DroneConfig, FlightEvent, FlightEventType } from '../types';
import {
  aStarPathfind,
  rrtPathfind,
  smoothPath,
  calculateFlightStats,
  checkTerrainCollision,
  exportKML,
  mockNoFlyZones,
  mockTerrainData,
} from '../utils/pathfinding';

export const useDroneStore = defineStore('drone', () => {
  const waypoints = ref<Waypoint[]>([]);
  const noFlyZones = ref<NoFlyZone[]>([]);
  const terrainData = ref<TerrainPoint[]>([]);
  const currentPlan = ref<FlightPlan | null>(null);
  const selectedAlgorithm = ref<'astar' | 'rrt'>('astar');
  const isSimulating = ref(false);
  const simProgress = ref(0);
  const mapCenter = ref<[number, number]>([39.9, 116.4]);
  const flightEvents = ref<FlightEvent[]>([]);
  const currentWaypointIndex = ref(-1);
  const simStartTime = ref<number>(0);

  const droneConfig = ref<DroneConfig>({
    maxAltitude: 500,
    maxSpeed: 20,
    batteryCapacity: 5000,
    consumptionRate: 100,
    safeDistance: 30,
  });

  // ─── Actions ──────────────────────────────────────────────────────────────
  function addWaypoint(
    lat: number,
    lng: number,
    altitude = 100,
    speed = 10,
    action: Waypoint['action'] = 'none'
  ) {
    const id = `wp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    waypoints.value.push({ id, lat, lng, altitude, speed, action });
  }

  function removeWaypoint(id: string) {
    waypoints.value = waypoints.value.filter((w) => w.id !== id);
  }

  function updateWaypoint(id: string, updates: Partial<Waypoint>) {
    const wp = waypoints.value.find((w) => w.id === id);
    if (wp) Object.assign(wp, updates);
  }

  function planRoute(start: [number, number], goal: [number, number]) {
    const bounds = { minLat: 39.85, maxLat: 39.95, minLng: 116.35, maxLng: 116.45 };
    let raw: Waypoint[];
    if (selectedAlgorithm.value === 'astar') {
      raw = aStarPathfind(start, goal, 30, noFlyZones.value, bounds);
    } else {
      raw = rrtPathfind(start, goal, noFlyZones.value);
    }
    const smoothed = smoothPath(raw);
    waypoints.value = smoothed;
    updatePlan();
  }

  function clearRoute() {
    waypoints.value = [];
    currentPlan.value = null;
    simProgress.value = 0;
    clearFlightEvents();
  }

  function updatePlan() {
    const stats = calculateFlightStats(waypoints.value, droneConfig.value);
    currentPlan.value = {
      id: `plan-${Date.now()}`,
      name: 'Flight Plan',
      waypoints: [...waypoints.value],
      totalDistance: stats.totalDistance,
      estimatedTime: stats.estimatedTime,
      batteryUsage: stats.batteryUsage,
    };
  }

  let simInterval: ReturnType<typeof setInterval> | null = null;

  function addFlightEvent(
    type: FlightEventType,
    message: string,
    options?: Partial<FlightEvent>
  ) {
    const event: FlightEvent = {
      id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      timestamp: Date.now(),
      message,
      ...options,
    };
    flightEvents.value.push(event);
  }

  function clearFlightEvents() {
    flightEvents.value = [];
    currentWaypointIndex.value = -1;
  }

  function getSimWaypointIndex(): number {
    const progress = simProgress.value / 100;
    const totalWp = waypoints.value.length;
    if (totalWp < 2) return -1;
    const idx = Math.min(Math.floor(progress * (totalWp - 1)), totalWp - 2);
    const segProgress = progress * (totalWp - 1) - idx;
    return segProgress >= 0.99 ? idx + 1 : idx;
  }

  function simulateFlight() {
    if (waypoints.value.length < 2 || isSimulating.value) return;
    isSimulating.value = true;
    simProgress.value = 0;
    simStartTime.value = Date.now();
    clearFlightEvents();

    const startWp = waypoints.value[0];
    addFlightEvent('takeoff', '无人机起飞', {
      waypointIndex: 0,
      waypointId: startWp.id,
      lat: startWp.lat,
      lng: startWp.lng,
      altitude: startWp.altitude,
    });
    currentWaypointIndex.value = 0;

    let lastWpIdx = 0;
    const totalWp = waypoints.value.length;

    simInterval = setInterval(() => {
      simProgress.value += 1;

      const currentIdx = getSimWaypointIndex();
      if (currentIdx > lastWpIdx && currentIdx < totalWp) {
        for (let i = lastWpIdx + 1; i <= currentIdx; i++) {
          const wp = waypoints.value[i];
          currentWaypointIndex.value = i;

          addFlightEvent('waypoint_reached', `到达航点 WP${i + 1}`, {
            waypointIndex: i,
            waypointId: wp.id,
            lat: wp.lat,
            lng: wp.lng,
            altitude: wp.altitude,
          });

          if (wp.action !== 'none') {
            const actionNames: Record<string, string> = {
              hover: '悬停',
              photo: '拍照',
              video: '录像',
            };
            addFlightEvent('action_start', `开始${actionNames[wp.action]}`, {
              waypointIndex: i,
              waypointId: wp.id,
              details: `动作: ${wp.action}`,
            });

            addFlightEvent('action_end', `完成${actionNames[wp.action]}`, {
              waypointIndex: i,
              waypointId: wp.id,
            });
          }
        }
        lastWpIdx = currentIdx;
      }

      if (simProgress.value >= 100) {
        simProgress.value = 100;
        isSimulating.value = false;
        const endWp = waypoints.value[totalWp - 1];
        addFlightEvent('landing', '无人机降落', {
          waypointIndex: totalWp - 1,
          waypointId: endWp.id,
          lat: endWp.lat,
          lng: endWp.lng,
          altitude: 0,
        });
        if (simInterval) clearInterval(simInterval);
      }
    }, 50);
  }

  function loadMockData() {
    noFlyZones.value = mockNoFlyZones;
    terrainData.value = mockTerrainData;
  }

  function exportPlan(): string {
    if (!currentPlan.value) return '';
    return exportKML(currentPlan.value);
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const totalDistance = computed(() => {
    if (!currentPlan.value) return 0;
    return currentPlan.value.totalDistance;
  });

  const estimatedTime = computed(() => {
    if (!currentPlan.value) return 0;
    return currentPlan.value.estimatedTime;
  });

  const batteryPercent = computed(() => {
    if (!currentPlan.value) return 0;
    return currentPlan.value.batteryUsage;
  });

  const terrainProfile = computed(() => {
    if (waypoints.value.length < 2) return [];
    return waypoints.value.map((wp) => {
      let nearestElev = 0;
      let minDist = Infinity;
      for (const tp of terrainData.value) {
        const d =
          (tp.lat - wp.lat) ** 2 + (tp.lng - wp.lng) ** 2;
        if (d < minDist) {
          minDist = d;
          nearestElev = tp.elevation;
        }
      }
      return {
        lat: wp.lat,
        lng: wp.lng,
        altitude: wp.altitude,
        terrainElevation: nearestElev,
      };
    });
  });

  return {
    waypoints,
    noFlyZones,
    terrainData,
    currentPlan,
    droneConfig,
    selectedAlgorithm,
    isSimulating,
    simProgress,
    mapCenter,
    flightEvents,
    currentWaypointIndex,
    simStartTime,
    totalDistance,
    estimatedTime,
    batteryPercent,
    terrainProfile,
    addWaypoint,
    removeWaypoint,
    updateWaypoint,
    planRoute,
    clearRoute,
    simulateFlight,
    loadMockData,
    exportPlan,
    updatePlan,
    clearFlightEvents,
    addFlightEvent,
  };
});
