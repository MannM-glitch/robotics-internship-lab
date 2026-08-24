import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BookOpen,
  Gauge,
  GitBranch,
  Map,
  Pause,
  Play,
  RotateCcw,
  Radar,
  SlidersHorizontal,
  Target
} from 'lucide-react';
import {
  clamp,
  createPid,
  distance,
  getHeadingError,
  makeSensorReadings,
  stepDifferentialDrive,
  type Obstacle,
  type PidState,
  type RobotState,
  type SensorReading,
  type Waypoint
} from './robotics';
import './styles.css';

type Mode = 'control' | 'sensors' | 'planner' | 'ros';

const FIELD_WIDTH = 900;
const FIELD_HEIGHT = 560;
const WHEEL_BASE = 54;

const waypoints: Waypoint[] = [
  { x: 170, y: 126 },
  { x: 705, y: 124 },
  { x: 744, y: 430 },
  { x: 254, y: 438 }
];

const obstacles: Obstacle[] = [
  { x: 438, y: 164, radius: 54 },
  { x: 566, y: 362, radius: 70 },
  { x: 302, y: 302, radius: 42 }
];

const startingRobot: RobotState = {
  x: 118,
  y: 104,
  heading: 0.24,
  leftVelocity: 0,
  rightVelocity: 0
};

const lessons = {
  control: {
    eyebrow: 'Controls',
    title: 'PID steering turns angle error into wheel commands.',
    points: ['P reacts now', 'I remembers bias', 'D dampens fast changes']
  },
  sensors: {
    eyebrow: 'Sensors',
    title: 'Range rays show why robots never receive perfect truth.',
    points: ['Noise shifts readings', 'Range limits hide far objects', 'Confidence belongs in every log']
  },
  planner: {
    eyebrow: 'Planning',
    title: 'Waypoints convert a hard route into reachable local goals.',
    points: ['Pick the next target', 'Reduce distance error', 'Advance when close enough']
  },
  ros: {
    eyebrow: 'ROS2',
    title: 'Robot apps become easier to debug when split into nodes and topics.',
    points: ['sensor_node publishes ranges', 'controller_node subscribes to goals', 'dashboard_node records state']
  }
} satisfies Record<Mode, { eyebrow: string; title: string; points: string[] }>;

function useAnimationFrame(enabled: boolean, callback: (dt: number) => void) {
  const frameRef = useRef<number | undefined>(undefined);
  const lastRef = useRef<number | undefined>(undefined);
  const callbackRef = useRef(callback);

  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const tick = (time: number) => {
      if (lastRef.current === undefined) {
        lastRef.current = time;
      }
      const dt = Math.min((time - lastRef.current) / 1000, 0.05);
      lastRef.current = time;
      callbackRef.current(dt);
      frameRef.current = requestAnimationFrame(tick);
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== undefined) {
        cancelAnimationFrame(frameRef.current);
      }
      lastRef.current = undefined;
    };
  }, [enabled]);
}

function drawField(
  canvas: HTMLCanvasElement,
  robot: RobotState,
  currentWaypoint: number,
  sensors: SensorReading[],
  path: Waypoint[]
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return;
  }

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.setTransform((rect.width * dpr) / FIELD_WIDTH, 0, 0, (rect.height * dpr) / FIELD_HEIGHT, 0, 0);

  ctx.fillStyle = '#f7f4ed';
  ctx.fillRect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);

  ctx.strokeStyle = '#d8d2c4';
  ctx.lineWidth = 1;
  for (let x = 0; x <= FIELD_WIDTH; x += 45) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, FIELD_HEIGHT);
    ctx.stroke();
  }
  for (let y = 0; y <= FIELD_HEIGHT; y += 45) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(FIELD_WIDTH, y);
    ctx.stroke();
  }

  ctx.strokeStyle = '#263238';
  ctx.lineWidth = 3;
  ctx.strokeRect(10, 10, FIELD_WIDTH - 20, FIELD_HEIGHT - 20);

  ctx.strokeStyle = '#597a96';
  ctx.lineWidth = 3;
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  waypoints.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.setLineDash([]);

  if (path.length > 1) {
    ctx.strokeStyle = 'rgba(15, 139, 141, 0.76)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    path.forEach((point, index) => {
      if (index === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    });
    ctx.stroke();
  }

  obstacles.forEach((obstacle) => {
    const gradient = ctx.createRadialGradient(
      obstacle.x - 14,
      obstacle.y - 18,
      8,
      obstacle.x,
      obstacle.y,
      obstacle.radius
    );
    gradient.addColorStop(0, '#f6a35b');
    gradient.addColorStop(1, '#a0473a');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(obstacle.x, obstacle.y, obstacle.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#78362f';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  waypoints.forEach((point, index) => {
    ctx.fillStyle = index === currentWaypoint ? '#0f8b8d' : '#6d7c84';
    ctx.beginPath();
    ctx.arc(point.x, point.y, index === currentWaypoint ? 12 : 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(index + 1), point.x, point.y + 1);
  });

  sensors.forEach((reading) => {
    const absolute = robot.heading + reading.angle;
    const endX = robot.x + Math.cos(absolute) * reading.distance;
    const endY = robot.y + Math.sin(absolute) * reading.distance;
    ctx.strokeStyle = reading.hit ? 'rgba(196, 87, 70, 0.6)' : 'rgba(15, 139, 141, 0.32)';
    ctx.lineWidth = reading.hit ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(robot.x, robot.y);
    ctx.lineTo(endX, endY);
    ctx.stroke();
  });

  ctx.save();
  ctx.translate(robot.x, robot.y);
  ctx.rotate(robot.heading);

  ctx.fillStyle = '#263238';
  roundRect(ctx, -34, -22, 68, 44, 8);
  ctx.fill();
  ctx.fillStyle = '#21a0a0';
  roundRect(ctx, -14, -17, 38, 34, 5);
  ctx.fill();
  ctx.fillStyle = '#f3c969';
  ctx.beginPath();
  ctx.moveTo(38, 0);
  ctx.lineTo(20, -12);
  ctx.lineTo(20, 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#11191c';
  roundRect(ctx, -30, -31, 52, 10, 4);
  ctx.fill();
  roundRect(ctx, -30, 21, 52, 10, 4);
  ctx.fill();
  ctx.restore();
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [running, setRunning] = useState(true);
  const [mode, setMode] = useState<Mode>('control');
  const [robot, setRobot] = useState<RobotState>(startingRobot);
  const [pid, setPid] = useState<PidState>(() => createPid(2.4, 0.02, 0.45));
  const [speed, setSpeed] = useState(74);
  const [noise, setNoise] = useState(9);
  const [currentWaypoint, setCurrentWaypoint] = useState(0);
  const [path, setPath] = useState<Waypoint[]>([{ x: startingRobot.x, y: startingRobot.y }]);

  const target = waypoints[currentWaypoint];
  const headingError = getHeadingError(robot, target);
  const targetDistance = distance(robot, target);
  const sensors = useMemo(
    () => makeSensorReadings(robot, obstacles, FIELD_WIDTH, FIELD_HEIGHT, noise),
    [robot, noise]
  );
  const closestSensor = sensors.reduce((best, item) => Math.min(best, item.distance), Number.POSITIVE_INFINITY);
  const lesson = lessons[mode];

  useAnimationFrame(running, (dt) => {
    setRobot((currentRobot) => {
      const activeTarget = waypoints[currentWaypoint];
      const error = getHeadingError(currentRobot, activeTarget);
      const nextPid = pid.step(error, dt);
      const turn = clamp(nextPid.output, -95, 95);
      const slowDown = clamp(distance(currentRobot, activeTarget) / 100, 0.28, 1);
      const leftVelocity = speed * slowDown - turn;
      const rightVelocity = speed * slowDown + turn;
      const nextRobot = stepDifferentialDrive(
        { ...currentRobot, leftVelocity, rightVelocity },
        dt,
        WHEEL_BASE,
        FIELD_WIDTH,
        FIELD_HEIGHT
      );

      setPid(nextPid.controller);
      setPath((currentPath) => {
        const last = currentPath[currentPath.length - 1];
        if (distance(last, nextRobot) < 8) {
          return currentPath;
        }
        return [...currentPath.slice(-180), { x: nextRobot.x, y: nextRobot.y }];
      });

      if (distance(nextRobot, activeTarget) < 28) {
        setCurrentWaypoint((index) => (index + 1) % waypoints.length);
      }

      return nextRobot;
    });
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    drawField(canvas, robot, currentWaypoint, sensors, path);
  }, [robot, currentWaypoint, sensors, path]);

  function reset() {
    setRobot(startingRobot);
    setPid(createPid(pid.kp, pid.ki, pid.kd));
    setCurrentWaypoint(0);
    setPath([{ x: startingRobot.x, y: startingRobot.y }]);
  }

  const rosRows = [
    ['planner_node', '/goal_waypoint', 'Waypoint'],
    ['range_sensor_node', '/range_scan', 'RangeReading[]'],
    ['pid_controller_node', '/wheel_cmd', 'WheelCommand'],
    ['dashboard_node', '/robot_state', 'RobotState']
  ];

  return (
    <main className="app-shell">
      <section className="top-bar" aria-label="Project overview">
        <div>
          <span className="label">Robotics Internship Lab</span>
          <h1>Control a simulated robot. Learn like an engineer.</h1>
        </div>
        <div className="status-strip" aria-label="Robot metrics">
          <Metric icon={<Target size={18} />} label="Goal error" value={`${Math.abs(headingError).toFixed(2)} rad`} />
          <Metric icon={<Gauge size={18} />} label="Distance" value={`${targetDistance.toFixed(0)} px`} />
          <Metric icon={<Radar size={18} />} label="Closest range" value={`${closestSensor.toFixed(0)} px`} />
        </div>
      </section>

      <section className="workbench">
        <aside className="panel controls-panel" aria-label="Controls">
          <div className="mode-tabs" role="tablist" aria-label="Learning module">
            {([
              ['control', SlidersHorizontal],
              ['sensors', Radar],
              ['planner', Map],
              ['ros', GitBranch]
            ] as const).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                className={mode === key ? 'tab active' : 'tab'}
                onClick={() => setMode(key)}
                aria-selected={mode === key}
                role="tab"
                title={key}
              >
                <Icon size={18} />
                <span>{key}</span>
              </button>
            ))}
          </div>

          <div className="control-row">
            <button
              type="button"
              className="icon-button primary"
              onClick={() => setRunning((value) => !value)}
              title={running ? 'Pause simulation' : 'Run simulation'}
              aria-label={running ? 'Pause simulation' : 'Run simulation'}
            >
              {running ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <button type="button" className="icon-button" onClick={reset} title="Reset robot" aria-label="Reset robot">
              <RotateCcw size={20} />
            </button>
          </div>

          <Slider label="Base speed" min={20} max={140} value={speed} unit="px/s" onChange={setSpeed} />
          <Slider label="Sensor noise" min={0} max={36} value={noise} unit="px" onChange={setNoise} />
          <Slider label="P gain" min={0} max={5} step={0.1} value={pid.kp} unit="" onChange={(value) => setPid(createPid(value, pid.ki, pid.kd))} />
          <Slider label="I gain" min={0} max={0.2} step={0.01} value={pid.ki} unit="" onChange={(value) => setPid(createPid(pid.kp, value, pid.kd))} />
          <Slider label="D gain" min={0} max={1.4} step={0.05} value={pid.kd} unit="" onChange={(value) => setPid(createPid(pid.kp, pid.ki, value))} />
        </aside>

        <section className="field-panel" aria-label="Robot field">
          <canvas ref={canvasRef} className="field-canvas" aria-label="Differential drive simulator" />
          <div className="path-readout" aria-label="Path statistics">
            <span>Waypoint {currentWaypoint + 1}/4</span>
            <span>{path.length} trace samples</span>
            <span>{running ? 'running' : 'paused'}</span>
          </div>
        </section>

        <aside className="panel lesson-panel" aria-label="Learning notes">
          <div className="lesson-heading">
            <BookOpen size={20} />
            <div>
              <span className="label">{lesson.eyebrow}</span>
              <h2>{lesson.title}</h2>
            </div>
          </div>
          <ul className="lesson-list">
            {lesson.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>

          {mode === 'ros' ? (
            <table className="ros-table">
              <thead>
                <tr>
                  <th>Node</th>
                  <th>Topic</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                {rosRows.map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}</td>
                    <td>{row[1]}</td>
                    <td>{row[2]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="experiment">
              <Activity size={20} />
              <div>
                <span className="label">Experiment note</span>
                <p>
                  Heading error is {headingError.toFixed(2)} rad while the robot is {targetDistance.toFixed(0)} px
                  from its next waypoint.
                </p>
              </div>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function Slider({
  label,
  min,
  max,
  step = 1,
  value,
  unit,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step?: number;
  value: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="slider-row">
      <span>
        {label}
        <strong>
          {value.toFixed(step < 1 ? 2 : 0)} {unit}
        </strong>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
      />
    </label>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
