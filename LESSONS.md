# Lessons

## Lesson 1: What is a robot?

A robot is a machine that repeatedly runs this loop:

1. Sense the world.
2. Estimate what is happening.
3. Decide what to do next.
4. Act through motors or other outputs.
5. Measure whether the action helped.

This app starts with a two-wheeled differential-drive robot because it is simple enough to understand and still real enough to teach the foundations used by bigger robots.

## Lesson 2: Differential drive

A differential-drive robot has a left wheel and a right wheel. If both wheels move at the same speed, the robot drives straight. If one wheel moves faster, the robot turns.

The app stores robot state as:

- `x`: horizontal position
- `y`: vertical position
- `heading`: direction the robot is facing
- `leftVelocity`: left wheel speed
- `rightVelocity`: right wheel speed

That state is updated by kinematics, which is the math of motion without worrying about forces.

## Lesson 3: PID control

PID means proportional, integral, derivative.

- Proportional reacts to the current error.
- Integral reacts to accumulated error.
- Derivative reacts to how fast the error is changing.

In this project, the error is the angle between where the robot is facing and where the next waypoint is. Tuning PID is a classic robotics internship skill because it shows that you can connect code, math, and observed behavior.

## Lesson 4: Sensors are imperfect

Real sensors have noise, limits, and blind spots. The simulator includes simple range rays so you can see how a robot receives partial information instead of a perfect map.

Good robotics engineers do not just ask whether the robot moved. They ask what the robot believed, what data it used, and how wrong that data might have been.

