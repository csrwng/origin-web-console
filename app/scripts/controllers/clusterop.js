'use strict';

/**
 * @ngdoc function
 * @name openshiftConsole.controller:ImagesController
 * @description
 * # ProjectController
 * Controller of the openshiftConsole
 */
angular.module('openshiftConsole')
  .controller('ClusterOpController', function (
    $filter,
    $routeParams,
    $scope,
    APIService,
    DataService,
    LabelFilter,
    Logger,
    ProjectsService) {
    $scope.projectName = $routeParams.project;
    $scope.imageStreams = {};
    $scope.unfilteredImageStreams = {};
    $scope.missingStatusTagsByImageStream = {};
    $scope.builds = {};
    $scope.labelSuggestions = {};
    $scope.clearFilter = function() {
      LabelFilter.clear();
    };

    var clustersVersion = APIService.toResourceGroupVersion({resource: "clusters", group: "clusteroperator.openshift.io"});
    var machineSetsVersion = APIService.toResourceGroupVersion({resource: "machinesets", group: "clusteroperator.openshift.io"});

    var watches = [];

    ProjectsService
      .get($routeParams.project)
      .then(_.spread(function(project, context) {
        $scope.project = project;
        watches.push(DataService.watch(clustersVersion, context, function(clusters) {
          $scope.clustersLoaded = true;
          $scope.clusters = clusters.by("metadata.name");
        }));
        watches.push(DataService.watch(machineSetsVersion, context, function(machineSets) {
          $scope.machineSets = machineSets.by("metadata.name");
          $scope.machineSetsByCluster = {};
          angular.forEach($scope.machineSets, function(machineSet) {
            var owningCluster = machineSet.metadata.ownerReferences[0].name;
            var clusterMachineSets = $scope.machineSetsByCluster[owningCluster];
            if (!clusterMachineSets) {
              clusterMachineSets = {};
              $scope.machineSetsByCluster[owningCluster] = clusterMachineSets;
            }
            var label;
            if (machineSet.spec.nodeType == "Master") {
              label = "Master";
            } else if (machineSet.spec.infra) {
              label = "Infra";
            } else {
              label = "Compute";
            }
            clusterMachineSets[label] = machineSet;
          });
        }));

        $scope.$on('$destroy', function(){
          DataService.unwatchAll(watches);
        });

      }));
  });
