![screenshot](https://raw.githubusercontent.com/slwen/robocoop/master/avatar.png)

## Commands

Robocoop listens for these commands:

> - new challenge *[amount]* *[exercise]* by *[day]* in sets of *[reps]*
> - end the challenge
> - remind *[daily/hourly/half-hourly/never]*
> - I did *[amount]*
> - Undo *[amount]*
> - leaderboard
> - status
> - help

## Requirements

- node.js (v5.x)
- redis & redis-cli

## Running locally

#### Start redis

Run with no extra config. Use `redis-cli` to interact and monitor.

```sh
$ redis-server # start the redis server
```

#### Environment variables

You should have an API token from Slack. Set in your environment:

```sh
$ TOKEN=your-slack-api-token-here
```

#### Start the node app

The application uses `nodemon` and will auto-restart when you make changes.

```sh
$ npm install
$ npm run dev
```
