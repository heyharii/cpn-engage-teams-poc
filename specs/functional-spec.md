# Functional Spec

## Employee App

### Home Dashboard

Purpose:

- orient employees quickly
- show momentum and next action

Behavior:

- display current journey progress
- show next assigned module
- show pending challenge
- show recent recognition summary
- show current leaderboard position

### Learning Journey

Behavior:

- employee sees assigned modules
- employee opens a module
- employee views lesson content
- employee marks completion
- completion creates a points event

### Challenge And Quiz

Behavior:

- employee receives a challenge
- employee answers MCQ prompts
- optional reflection can be submitted
- challenge completion creates a points event

### Reflection Submission

Behavior:

- employee selects or inherits the current behavior context
- employee writes a reflection
- reflection is saved privately
- manager or admin visibility follows the campaign rule

### Recognition Submission

Behavior:

- employee selects a colleague
- employee selects a behavior
- employee writes a recognition note
- employee uploads an optional image
- recognition enters approval flow

## Public Feed

### Feed Post Types

- recognition post
- leaderboard post
- campaign announcement

### Feed Rules

- approved recognition becomes a public post
- leaderboard posts are generated from snapshot data
- announcement posts are created by admins
- feed items can show comments and reactions later, but the POC should at minimum support read-only feed display

## Admin Console

### Campaign Composer

Behavior:

- admin creates a campaign
- admin chooses target audience
- admin selects destination
- admin schedules or publishes content

### Moderation Queue

Behavior:

- admin sees pending recognition
- admin can approve, reject, or edit content
- approval creates a public feed event

### Analytics

Behavior:

- dashboard shows usage totals
- dashboard shows module completions
- dashboard shows challenge participation
- dashboard shows recognition volume
- dashboard shows feed activity

## Notifications

### Required Notification Types

- module assigned
- challenge reminder
- recognition awaiting approval
- weekly leaderboard summary

## Native Communities Spike

Behavior:

- authenticate through delegated Microsoft login
- list accessible Viva Engage groups
- attempt to publish a plain post
- capture result, limits, and posting identity
