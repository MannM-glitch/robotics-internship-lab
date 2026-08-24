# Robotics Internship Lab

An interactive beginner robotics portfolio app for learning the skills that repeatedly show up in robotics internship descriptions: controls, sensors, motion planning, ROS-style system thinking, testing, and experiment logs.

## What this repo is for

This is designed to be a public portfolio project you can talk about in internship applications:

- A browser simulator for a differential-drive robot, PID steering, noisy range sensors, and waypoint following.
- Small pure TypeScript robotics helpers with tests, so interviewers can see real engineering habits.
- A daily learning-log generator and GitHub Action that can push steady progress commits.
- Plain-English lessons for someone starting from zero.

## Skill scan

Scan date: August 24, 2026.

Recent robotics internship descriptions emphasized:

- Programming: Python, C++, TypeScript/JavaScript, Git, Linux, and testing.
- Robotics stack: ROS or ROS2, simulation, sensor pipelines, robot state, autonomy loops.
- Math and controls: kinematics, PID control, coordinate frames, dynamics basics.
- Perception and planning: cameras, lidar/range sensors, computer vision, SLAM or mapping, path planning.
- Engineering habits: debugging, data logs, clear documentation, experiments, collaboration.

Sources checked while creating the roadmap:

- [Amazon Robotics Software Development Engineer Intern/Co-op 2026](https://www.amazon.jobs/en/jobs/3136266/robotics-software-development-engineer-intern-co-op-2026)
- [MERL internship openings](https://www.merl.com/employment/internship-openings)
- [Apptronik Robotics Software Intern - Real-Time Controls](https://job-boards.greenhouse.io/apptronik/jobs/5985132004)
- [Lunar Outpost Robotics Engineering Intern - Summer 2026](https://jobs.type1ventures.com/companies/lunar-outpost/jobs/58926030-robotics-engineering-intern-summer-2026)
- [ROS Jobs wiki](https://wiki.ros.org/Jobs)

## Quick start

```bash
npm install
npm run dev
```

Then open the URL printed by Vite.

## Scripts

```bash
npm run dev      # Start the app locally
npm run build    # Type-check and build
npm test         # Run unit tests
npm run daily    # Add today's learning-log entry
```

## Portfolio plan

Week 1: Learn the robot loop. Run the simulator, tune PID gains, explain overshoot.

Week 2: Add a new sensor model. Save noisy readings and compare filtered versus raw values.

Week 3: Add obstacle-aware planning. Explain why the planner fails in one scenario.

Week 4: Add a ROS2-style architecture note. Map app modules to nodes, topics, and messages.

Week 5: Add a small computer-vision module or camera mock. Track a colored target.

Week 6: Write a final demo README with screenshots, metrics, tests, and lessons learned.

## Daily commits

The workflow in `.github/workflows/daily-progress.yml` runs once a day. It creates a dated learning log from `data/missions.json`, runs tests, commits the update, and pushes it with `GITHUB_TOKEN`.

GitHub scheduled workflows only run after this repo is pushed to GitHub and Actions are enabled for the repository.
