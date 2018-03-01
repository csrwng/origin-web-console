"use strict";

angular.module('openshiftConsole')
  .directive('machineSetDonut', function($timeout,
                                  Logger,
                                  ChartsService) {
    return {
      restrict: 'E',
      scope: {
        machineset: '=',
        mini: '=?'
      },
      templateUrl: 'views/directives/machineset-donut.html',
      link: function($scope, element) {
        var chart, config;

        // The phases to show (in order).
        var phases = ["Provisioning", "Installing", "ComponentsInstalling", "Accepting", "Ready", "Deprovisioning", "Unknown"];

        $scope.chartId = _.uniqueId('machinesets-donut-chart-');

        function machineSetSize(machineSet) {
          return machineSet.spec.size;
        }

        function updateMachineSetCount() {
          var machineSet = $scope.machineset;
          var total = machineSetSize(machineSet);
          if ($scope.mini) {
            $scope.$evalAsync(function() {
              $scope.total = total;
            });
            return;
          }

          var smallText = (total === 1) ? "machine" : "machines";
          ChartsService.updateDonutCenterText(element[0], total, smallText);
        }

        // c3.js config for the chart
        config = {
          type: "donut",
          bindto: '#' + $scope.chartId,
          donut: {
            // disable hover expansion
            expand: false,
            label: {
              show: false
            },
            width: $scope.mini ? 5 : 10
          },
          size: {
            height: $scope.mini ? 45 : 150,
            width: $scope.mini ? 45 : 150
          },
          legend: {
            show: false
          },
          onrendered: updateMachineSetCount,
          tooltip: {
            format: {
              value: function(value, ratio, id) {
                // We add all phases to the data, even if count 0, to force a cut-line at the top of the donut.
                // Don't show tooltips for phases with 0 count.
                if (!value) {
                  return undefined;
                }

                // Disable the tooltip for empty donuts.
                if (id === "Empty") {
                  return undefined;
                }

                // Show the count rather than a percentage.
                return value;
              }
            }
          },
          transition: {
            duration: 350
          },
          data: {
            type: "donut",
            groups: [ phases ],
            // Keep groups in our order.
            order: null,
            colors: {
              Empty: "#ffffff",
              Provisioning: "#ccf6ff",
              Installing: "#66e3ff",
              Accepting: "#66e3ff",
              ComponentsInstalling: "00d0ff",
              Ready: "#00b9e4",
              "Not Ready": "#beedf9",
              Deprovisioning: "#00659c",
              Unknown: "#f9d67a"
            },
            selection: {
              enabled: false
            }
          }
        };

        if ($scope.mini) {
          config.padding = {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0
          };
        }

        function updateChart(countByPhase) {
          var data = {
            columns: []
          };
          angular.forEach(phases, function(phase) {
            data.columns.push([phase, countByPhase[phase] || 0]);
          });

          if (_.isEmpty(countByPhase)) {
            // Add a dummy group to draw an arc, which we style in CSS.
            data.columns.push(["Empty", 1]);
          } else {
            // Unload the dummy group if present when there's real data.
            data.unload = "Empty";
          }

          if (!chart) {
            config.data.columns = data.columns;
            chart = c3.generate(config);
          } else {
            chart.load(data);
          }
        }

        function currentCount() {
          return machineSetSize($scope.machineset);
        }

        function currentPhase() {
          var machineSet = $scope.machineset;
          var phase = "";
          if (machineSet.metadata.deletionTimestamp) {
            phase = "Deprovisioning";
          } else {
            angular.forEach(machineSet.status.conditions, function(condition) {
              if (condition.type === "HardwareProvisioning" && condition.status === "True") {
                phase = "Provisioning";
              } else if (condition.type === "Installing" && condition.status === "True") {
                phase = "Installing";
              } else if (condition.type === "ComponentsInstalling" && condition.status === "True") {
                phase = "ComponentsInstalling";
              } else if (condition.type === "Accepting" && condition.status === "True") {
                phase = "Accepting";
              } else if ((condition.type === "Accepted" && condition.status === "True") ||
                        (condition.type === "ComponentsInstalled" && condition .status === "True")) {
                phase = "Ready";
              }
            });
          }

          if (!phase) {
            phase = "Unknown";
          }

          return phase;
        }

        function countMachinePhases() {
          var phase = currentPhase();
          var countByPhase = { };
          countByPhase[phase] = currentCount();
          return countByPhase;
        }

        var debounceUpdate = _.debounce(updateChart, 350, { maxWait: 500 });
        $scope.$watch(countMachinePhases, debounceUpdate, true);
        $scope.$watchGroup(['desired','idled'], updateMachineSetCount);

        $scope.$on('destroy', function() {
          if (chart) {
            // http://c3js.org/reference.html#api-destroy
            chart = chart.destroy();
          }
        });
      }
    };
  });
