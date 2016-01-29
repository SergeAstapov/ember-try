var CoreObject    = require('core-object');
var fs            = require('fs-extra');
var RSVP          = require('rsvp');
var path          = require('path');
var extend        = require('extend');
var rimraf        = RSVP.denodeify(require('rimraf'));

module.exports = CoreObject.extend({
  init: function() {
    this._super.apply(this, arguments);
    this.run = this.run || require('./run');
  },
  configKey: 'npm',
  packageJSON: 'package.json',
  packageJSONBackupFileName: 'package.json.ember-try',
  nodeModules: 'node_modules',
  nodeModulesBackupLocation: '.node_modules.ember-try',
  setup: function() {
    return this._backupOriginalDependencies();
  },
  changeToDependencySet: function(depSet) {
    var adapter = this;
    depSet = depSet[adapter.configKey];
    if (!depSet) { return RSVP.resolve([]); }
    var backupPackageJSON = path.join(adapter.cwd, adapter.packageJSONBackupFileName);
    var packageJSONFile = path.join(adapter.cwd, adapter.packageJSON);
    var packageJSON = JSON.parse(fs.readFileSync(backupPackageJSON));
    var newPackageJSON = adapter._packageJSONForDependencySet(packageJSON, depSet);

    fs.writeFileSync(packageJSONFile, JSON.stringify(newPackageJSON, null, 2));
    return adapter._install().then(function() {
      var deps = extend({}, depSet.dependencies || {}, depSet.devDependencies || {});
      var currentDeps = Object.keys(deps).map(function(dep) {
        return {
          name: dep,
          versionExpected: deps[dep],
          versionSeen: adapter._findCurrentVersionOf(dep),
          packageManager: 'npm'
        };
      });
      return RSVP.Promise.resolve(currentDeps);
    });
  },
  cleanup: function() {
    var adapter = this;
    return adapter._restoreOriginalDependencies().then(function() {
      return RSVP.all([rimraf(path.join(adapter.cwd, adapter.packageJSONBackupFileName)),
      rimraf(path.join(adapter.cwd, adapter.nodeModulesBackupLocation))]);
    }).catch(function(e) {
      console.log('Error cleaning up npm scenario:', e);
    })
    .then(function() {
      return adapter._install();
    });
  },
  _findCurrentVersionOf: function(packageName) {
    var filename = path.join(this.cwd, this.nodeModules, packageName, this.packageJSON);
    if (fs.existsSync(filename)) {
      return JSON.parse(fs.readFileSync(filename)).version;
    } else {
      throw 'File ' + filename + ' does not exist';
    }
  },
  _install: function() {
    var adapter = this;
    return adapter.run('npm', ['install'], {cwd: adapter.cwd}).then(function() {
      return adapter.run('npm', ['prune'], {cwd: adapter.cwd});
    });
  },
  _packageJSONForDependencySet: function(packageJSON, depSet) {

    this._overridePackageJSONDependencies(packageJSON, depSet, 'dependencies');
    this._overridePackageJSONDependencies(packageJSON, depSet, 'devDependencies');

    return packageJSON;
  },
  _overridePackageJSONDependencies: function(packageJSON, depSet, kindOfDependency) {
    if (!depSet[kindOfDependency]) { return; }
    var pkgs = Object.keys(depSet[kindOfDependency]);

    pkgs.forEach(function(pkg) {
      if (!packageJSON[kindOfDependency]) {
        packageJSON[kindOfDependency] = {};
      }
      packageJSON[kindOfDependency][pkg] = depSet[kindOfDependency][pkg];
    });
  },
  _restoreOriginalDependencies: function() {
    var copy = RSVP.denodeify(fs.copy);
    return RSVP.all([
      copy(path.join(this.cwd, this.packageJSONBackupFileName),
           path.join(this.cwd, this.packageJSON)),
      copy(path.join(this.cwd, this.nodeModulesBackupLocation),
           path.join(this.cwd, this.nodeModules), {clobber: true})]);
  },
  _backupOriginalDependencies: function() {
    var copy = RSVP.denodeify(fs.copy);
    return RSVP.all([
      copy(path.join(this.cwd, this.packageJSON),
           path.join(this.cwd, this.packageJSONBackupFileName)),
      copy(path.join(this.cwd, this.nodeModules),
           path.join(this.cwd, this.nodeModulesBackupLocation), {clobber: true})]);
  }
});