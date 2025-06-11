/**
 * This file contains all workflow rule templates as constants
 */

/**
 * Template for action rule
 */
export const ACTION_TEMPLATE = `/**
 * This is a template for an action rule. This rule defines a custom command
 * and the changes that are applied by the command.
 *
 * For details, read the Quick Start Guide:
 * https://www.jetbrains.com/help/youtrack/devportal/Quick-Start-Guide-Workflows-JS.html
 */

const entities = require('@jetbrains/youtrack-scripting-api/entities');

exports.rule = entities.Issue.action({
  // TODO: give the rule a human-readable title
  title: '{TITLE}',
  //TODO: define user input, if needed
  userInput: null,
  // TODO: define the custom command
  command: '{COMMAND}',
  guard: (ctx) => {
    // TODO: define the condition that must be met to enable the custom command
    return true;
  },
  action: (ctx) => {
    const issue = ctx.issue;
    // TODO: specify what to do when the command is executed
  },
  requirements: {
    // TODO: add requirements
  }
});`;

/**
 * Template for custom rule
 */
export const CUSTOM_TEMPLATE = `/**
 * This is a template for a custom rule.
 *
 * For details, read the Quick Start Guide:
 * https://www.jetbrains.com/help/youtrack/devportal/Quick-Start-Guide-Workflows-JS.html
 */

exports.rule = {
  // TODO: implement your custom rule
  title: '{TITLE}'
};`;

/**
 * Template for on-change rule
 */
export const ON_CHANGE_TEMPLATE = `/**
 * This is a template for an on-change rule. This rule defines what
 * happens when a change is applied to an issue.
 *
 * For details, read the Quick Start Guide:
 * https://www.jetbrains.com/help/youtrack/devportal/Quick-Start-Guide-Workflows-JS.html
 */

const entities = require('@jetbrains/youtrack-scripting-api/entities');

exports.rule = entities.Issue.onChange({
  // TODO: give the rule a human-readable title
  title: '{TITLE}',
  guard: (ctx) => {
    // TODO specify the conditions for executing the rule
    return true;
  },
  action: (ctx) => {
    const issue = ctx.issue;
    // TODO: specify what to do when a change is applied to an issue
  },
  requirements: {
    // TODO: add requirements
  }
});`;

/**
 * Template for on-schedule rule
 */
export const ON_SCHEDULE_TEMPLATE = `/**
 * This is a template for an on-schedule rule. This rule defines
 * actions that should be performed on a set of issues on a schedule.
 *
 * For details, read the Quick Start Guide:
 * https://www.jetbrains.com/help/youtrack/devportal/Quick-Start-Guide-Workflows-JS.html
 */

const entities = require('@jetbrains/youtrack-scripting-api/entities');

exports.rule = entities.Issue.onSchedule({
  // TODO: give the rule a human-readable title
  title: '{TITLE}',
  // TODO: specify the schedule settings
  search: '',
  cron: '0 0 * * *',
  // TODO: add rule specific guard, if any
  guard: (ctx) => {
    return true;
  },
  // TODO: specify what you want to do when the rule 'wakes up'
  action: (ctx) => {
    const issues = ctx.issues;
    for (const issue of issues) {
      // You can access issue fields through issue.fields
    }
  },
  requirements: {
    // TODO: add requirements
  }
});`;

/**
 * Template for state machine per type rule
 */
export const STATE_MACHINE_PER_TYPE_TEMPLATE = `/**
 * This is a template for a state-machine rule where the workflow
 * depends on issue type.
 *
 * For details, read the Quick Start Guide:
 * https://www.jetbrains.com/help/youtrack/devportal/Quick-Start-Guide-Workflows-JS.html
 */

const entities = require('@jetbrains/youtrack-scripting-api/entities');

exports.rule = entities.Issue.stateMachine({
  // TODO: give the rule a human-readable title
  title: '{TITLE}',
  // TODO: customize the state machine fields
  fieldName: 'State',
  states: {
    'Feature': {
      initial: 'Open',
      resolved: 'Fixed',
      transitions: {
        'Open': {
          'In Progress': {
            on: 'start progress',
            fields: {},
            // TODO: customize requirements for this transition
            requirements: {}
          },
          'Won\\'t fix': {
            on: 'won\\'t fix',
            fields: {},
            // TODO: customize requirements for this transition
            requirements: {}
          },
          'Fixed': {
            on: 'fixed',
            fields: {},
            // TODO: customize requirements for this transition
            requirements: {}
          }
        },
        'In Progress': {
          'Fixed': {
            on: 'fixed',
            fields: {},
            // TODO: customize requirements for this transition
            requirements: {}
          },
          'Open': {
            on: 'stop progress',
            fields: {},
            // TODO: customize requirements for this transition
            requirements: {}
          }
        },
        'Fixed': {
          'Open': {
            on: 'reopen',
            fields: {},
            // TODO: customize requirements for this transition
            requirements: {}
          }
        },
        'Won\\'t fix': {
          'Open': {
            on: 'reopen',
            fields: {},
            // TODO: customize requirements for this transition
            requirements: {}
          }
        }
      }
    }
  }
});`;

/**
 * Template for state machine rule
 */
export const STATE_MACHINE_TEMPLATE = `/**
 * This is a template for a state-machine rule. This rule defines
 * what happens when an issue is moved from one state to another.
 *
 * For details, read the Quick Start Guide:
 * https://www.jetbrains.com/help/youtrack/devportal/Quick-Start-Guide-Workflows-JS.html
 */

const entities = require('@jetbrains/youtrack-scripting-api/entities');

exports.rule = entities.Issue.stateMachine({
  // TODO: give the rule a human-readable title
  title: '{TITLE}',
  // TODO: customize the state machine fields
  fieldName: 'State',
  states: {
    initial: 'Open',
    resolved: 'Fixed',
    transitions: {
      'Open': {
        'In Progress': {
          on: 'start progress',
          fields: {},
          // TODO: customize requirements for this transition
          requirements: {}
        }
      }
    }
  }
});`;

/**
 * Map of available templates
 */
export const TEMPLATES: Record<string, string> = {
  'action': ACTION_TEMPLATE,
  'custom': CUSTOM_TEMPLATE,
  'on-change': ON_CHANGE_TEMPLATE,
  'on-schedule': ON_SCHEDULE_TEMPLATE,
  'state-machine-per-type': STATE_MACHINE_PER_TYPE_TEMPLATE,
  'state-machine': STATE_MACHINE_TEMPLATE
};
