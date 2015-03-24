'use strict';

var path            = require('path');
var checkCanProceed = require('../utils/verify');

/*
  ember try:testall
  ember try 1.10.0 test

 */
module.exports = {
  name: 'try',
  description: 'Run test with the matrix of packages specified',
  works: 'insideProject',

  anonymousOptions: [
    '<scenario>',
    '<command (Default: test)>'
  ],

  run: function(commandOptions, rawArgs) {
    var scenarioName = rawArgs[0];
    var commandName = rawArgs[1] || 'test';

    if (!scenarioName) {
      throw new Error('The `ember try` command requires a ' +
                      'scenario name to be specified.');
    }

    checkCanProceed({project: this.project});

    var config = require('../utils/config')({ project: this.project });

    var TryTask = require('../tasks/try');
    var tryTask = new TryTask({
      ui: this.ui,
      project: this.project,
      config: config
    });

    var scenario = findByName(config.scenarios, scenarioName);
    return tryTask.run(scenario, commandName);
  }
};

function findByName(arr, name){
  var matches = arr.filter(function(item){
    if(item.name == name){
      return item;
    }
  });
  return matches[0];
}