export type RobotState = {
  x: number;
  y: number;
  heading: number;
  leftVelocity: number;
  rightVelocity: number;
};

export type Waypoint = {
  x: number;
  y: number;
};

export type Obstacle = {
  x: number;
  y: number;
  radius: number;
};

export type SensorReading = {
  angle: number;
  distance: number;
  hit: boolean;
};

export type PidState = {
  kp: number;
  ki: number;
  kd: number;
  integral: number;
  previousError: number;
  output: number;
  step: (error: number, dt: number) => { output: number; controller: PidState };
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function normalizeAngle(angle: number) {
  let next = angle;
  while (next > Math.PI) {
    next -= Math.PI * 2;
  }
  while (next < -Math.PI) {
    next += Math.PI * 2;
  }
  return next;
}

export function distance(a: Waypoint, b: Waypoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function getHeadingError(robot: RobotState, target: Waypoint) {
  const targetHeading = Math.atan2(target.y - robot.y, target.x - robot.x);
  return normalizeAngle(targetHeading - robot.heading);
}

export function createPid(
  kp: number,
  ki: number,
  kd: number,
  integral = 0,
  previousError = 0,
  output = 0
): PidState {
  return {
    kp,
    ki,
    kd,
    integral,
    previousError,
    output,
    step(error: number, dt: number) {
      const safeDt = Math.max(dt, 0.001);
      const nextIntegral = clamp(integral + error * safeDt, -8, 8);
      const derivative = (error - previousError) / safeDt;
      const nextOutput = kp * error + ki * nextIntegral + kd * derivative;

      return {
        output: nextOutput,
        controller: createPid(kp, ki, kd, nextIntegral, error, nextOutput)
      };
    }
  };
}

export function stepDifferentialDrive(
  robot: RobotState,
  dt: number,
  wheelBase: number,
  fieldWidth: number,
  fieldHeight: number
): RobotState {
  const linearVelocity = (robot.rightVelocity + robot.leftVelocity) / 2;
  const angularVelocity = (robot.rightVelocity - robot.leftVelocity) / wheelBase;
  const nextHeading = normalizeAngle(robot.heading + angularVelocity * dt);
  const nextX = clamp(robot.x + linearVelocity * Math.cos(nextHeading) * dt, 24, fieldWidth - 24);
  const nextY = clamp(robot.y + linearVelocity * Math.sin(nextHeading) * dt, 24, fieldHeight - 24);

  return {
    ...robot,
    x: nextX,
    y: nextY,
    heading: nextHeading
  };
}

export function makeSensorReadings(
  robot: RobotState,
  obstacles: Obstacle[],
  fieldWidth: number,
  fieldHeight: number,
  noise = 0
): SensorReading[] {
  const sensorAngles = [-0.82, -0.42, 0, 0.42, 0.82];
  return sensorAngles.map((angle, index) => {
    const maxRange = 210;
    const absoluteAngle = robot.heading + angle;
    const cast = castRange(robot, absoluteAngle, obstacles, fieldWidth, fieldHeight, maxRange);
    const deterministicNoise = noise * Math.sin(robot.x * 0.09 + robot.y * 0.05 + index * 1.7);
    return {
      angle,
      distance: clamp(cast.distance + deterministicNoise, 0, maxRange),
      hit: cast.hit
    };
  });
}

function castRange(
  origin: Waypoint,
  angle: number,
  obstacles: Obstacle[],
  fieldWidth: number,
  fieldHeight: number,
  maxRange: number
) {
  const step = 6;
  for (let distanceAlongRay = step; distanceAlongRay <= maxRange; distanceAlongRay += step) {
    const x = origin.x + Math.cos(angle) * distanceAlongRay;
    const y = origin.y + Math.sin(angle) * distanceAlongRay;
    const outsideField = x < 12 || x > fieldWidth - 12 || y < 12 || y > fieldHeight - 12;
    const hitsObstacle = obstacles.some((obstacle) => distance({ x, y }, obstacle) <= obstacle.radius);
    if (outsideField || hitsObstacle) {
      return { distance: distanceAlongRay, hit: true };
    }
  }

  return { distance: maxRange, hit: false };
}

