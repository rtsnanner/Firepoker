/*global angular*/
/*global Firebase*/
'use strict';

/**
 * MainCtrl
 *
 * FirePoker.io is a monolithic well tested app, so for now all it's
 * logic is on this single controller, in the future we could be splitting the logic
 * into diff files and modules.
 *
 * @author Everton Yoshitani <everton@wizehive.com>
 */
angular.module('firePokerApp')
    .controller('MainCtrl', function ($rootScope, $scope, $cookieStore, $location, $routeParams, angularFire) {
        // Firebase URL
        var URL = 'https://tr-ppoker.firebaseio.com';

        // Initialize Firebase
        var ref = new Firebase(URL);

        // UUID generator
        // Snippet from: http://stackoverflow.com/questions/105034/how-to-create-a-guid-uuid-in-javascript
        var s4 = function () {
            return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
        };

        var guid = function () {
            return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
        };

        // Load cookies
        $scope.fp = $cookieStore.get('fp');
        if (!$scope.fp) {
            $scope.fp = {};
        }

        // UID
        if (!$scope.fp.user || !$scope.fp.user.id) {
            var uid = guid();
            $scope.fp.user = { id: uid, active: true };
            $cookieStore.put('fp', $scope.fp);
        }

        // GID
        if (!$scope.fp.gid) {
            var gid = guid();
            $scope.fp.gid = gid;
            $cookieStore.put('fp', $scope.fp);
        }

        // Is landing page?
        $rootScope.isLandingPage = function () {
            return $location.path() !== '/';
        };

        // Redirect with a GID to create new games
        $scope.redirectToCreateNewGame = function () {
            if ($location.path() === '/games/new' || $location.path() === '/games/new/') {
                $scope.fp.gid = guid();
                $location.path('/games/new/' + $scope.fp.gid);
                $location.replace();
            }
        };

        $scope.decks = [{
            id: 0,
            cards: [0, 1, 2, 4, 8, 16, 32, 64, 128, '?', '☕'],
            description: '0, 1, 2, 4, 8, 16, 32, 64, 128 and ?,☕'
        },
        {
            id: 1,
            cards: [0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89, '?', '☕'],
            description: '0, 1, 2, 3, 5, 8, 13, 21, 34, 55, 89 and ?,☕',
            average: 'fibonacciAvg'
        },
        {
            id: 2,
            cards: [0, 0.5, 1, 2, 3, 5, 8, 13, 20, 40, 100, '?', '☕'],
            description: '0, ½, 1, 2, 3, 5, 8, 13, 20, 40, 100, and ?,☕'
        }
        ];

        $scope.fibonacciAvg = function (num) {
            var f = (n, x = 0, y = 1) => y < n ? f(n, y, x + y) : y - n > n - x ? x : y;
            return f(num);
        };

        // Redirect to set fullname if empty
        $scope.redirectToSetFullnameIfEmpty = function () {
            if (
                $routeParams.gid &&
                $location.path() === '/games/' + $routeParams.gid &&
                !$scope.fp.user.fullname
            ) {
                $location.path('/games/join/' + $routeParams.gid);
                $location.replace();
            }
        };

        // Redirect to game if fullname already set
        $scope.redirectToGameIfFullnameAlreadySet = function () {
            if (
                $routeParams.gid &&
                $location.path() === '/games/join/' + $routeParams.gid &&
                $scope.fp.user.fullname
            ) {
                $location.path('/games/' + $routeParams.gid).replace();
            }
        };

        $scope.toggleModerator = function (participant) {
            $scope.game.participants[participant.id].moderator = !$scope.game.participants[participant.id].moderator;
        };

        // Load game and register presence
        $scope.loadGame = function () {
            if ($scope.game && $scope.game.participants) {
                $scope.fp.user = $scope.game.participants[$scope.fp.user.id];
            }
            if ($routeParams.gid && $location.path() === '/games/' + $routeParams.gid) {
                angularFire(ref.child('/games/' + $routeParams.gid), $scope, 'game').then(function () {
                    // Is current user the game owner?
                    if ($scope.game.owner && $scope.game.owner.id && $scope.game.owner.id === $scope.fp.user.id) {
                        $scope.isOwner = true;
                    } else {
                        $scope.isOwner = false;
                    }
                });
                ref.child('/games/' + $routeParams.gid + '/participants/' + $scope.fp.user.id).set($scope.fp.user);
                var onlineRef = ref.child('/games/' + $routeParams.gid + '/participants/' + $scope.fp.user.id + '/online');
                var connectedRef = ref.child('/.info/connected');
                connectedRef.on('value', function (snap) {
                    if (snap.val() === true) {
                        // We're connected (or reconnected)!  Set up our presence state and
                        // tell the server to set a timestamp when we leave.
                        onlineRef.onDisconnect().set(Firebase.ServerValue.TIMESTAMP);
                        onlineRef.set(true);
                    }
                });
            }
        };

        // Create game
        $scope.createGame = function () {
            var stories = [],
                newGame = angular.copy($scope.newGame);
            if (newGame.stories) {
                angular.forEach(newGame.stories.split('\n'), function (title) {
                    var story = {
                        title: title,
                        status: 'queue'
                    };
                    stories.push(story);
                });
            }
            newGame.stories = stories;
            newGame.status = 'active';
            newGame.created = new Date().getTime();
            newGame.owner = $scope.fp.user;
            newGame.participants = false;
            newGame.estimate = false;
            $scope.setNewGame(newGame);
            $cookieStore.put('fp', $scope.fp);
            $location.path('/games/' + $routeParams.gid);
            $location.replace();
        };

        // Set new game
        $scope.setNewGame = function (game) {
            ref.child('/games/' + $routeParams.gid).set(game);
        };

        $scope.toggleObservator = function () {
            $scope.game.participants[$scope.fp.user.id].active = !$scope.game.participants[$scope.fp.user.id].active;
        };

        // Create story
        $scope.createStory = function (type) {
            if (type === 'structured') {
                var title = 'As a/an ' +
                    $scope.newStory.asA +
                    ' I would like to ' +
                    $scope.newStory.iWouldLikeTo +
                    ' so that ' +
                    $scope.newStory.soThat;
                $scope.newStory.title = title;
                delete $scope.newStory.asA;
                delete $scope.newStory.iWouldLikeTo;
                delete $scope.newStory.soThat;
            }
            $scope.showCardDeck = true;
            $scope.newStory.results = false;
            $scope.newStory.points = 0;
            $scope.newStory.status = 'queue';
            $scope.newStory.startedAt = false;
            $scope.newStory.endedAt = false;
            if (!$scope.game.stories) {
                $scope.game.stories = [];
            }
            $scope.game.stories.push($scope.newStory);
            $scope.newStory = null;
            // Set this story if there is none active
            // maybe this is good thing todo only if the queue is empty
            if (!$scope.game.estimate) {
                $scope.setStory($scope.game.stories.length - 1);
            }
        };

        // Set story
        $scope.setStory = function (index) {
            $scope.cancelRound();
            $scope.game.estimate = $scope.game.stories[index];
            $scope.game.estimate.status = 'active';
            $scope.game.estimate.id = index;
            $scope.game.estimate.startedAt = new Date().getTime();
            $scope.game.estimate.endedAt = false;
            $scope.showCardDeck = true;
        };

        // Delete story
        $scope.deleteStory = function (index) {
            $scope.game.stories.splice(index, 1);
        };

        // removes a vote
        $scope.unvote = function (voter) {
            if ($scope.game.participants[voter.id].hasVoted && $scope.game && $scope.game.estimate && $scope.game.estimate.results) {
                angular.forEach($scope.game.estimate.results, function (vote) {
                    if (vote.user.id == $scope.game.participants[voter.id].id) {
                        var index = $scope.game.estimate.results.indexOf(vote);
                        $scope.game.estimate.results.splice(index, 1);
                        $scope.game.participants[voter.id].hasVoted = false;
                        return;
                    }
                });
            }
        };

        // Estimate story
        $scope.estimate = function (points, object) {
            if (!$scope.game.estimate.results) {
                $scope.game.estimate.results = [];
            }
            $scope.game.estimate.results.push({ points: points, user: $scope.fp.user });
            $(object).css('selected');
            $scope.fp.user.estimate = points;
        };

        // Show checkmarks when participant has voted
        $scope.setShowCheckmarks = function () {
            if ($scope.game.estimate && $scope.game.estimate.results) {
                angular.forEach($scope.game.estimate.results, function (result) {
                    if (
                        result &&
                        result.user &&
                        result.user.id &&
                        result.user.id === $scope.fp.user.id
                    ) {
                        $scope.game.participants[result.user.id].hasVoted = true;
                    }
                });
            }
        };

        // Set full name
        $scope.setFullname = function () {
            $cookieStore.put('fp', $scope.fp);
            $location.path('/games/' + $routeParams.gid);
            $location.replace();
        };

        // Get estimate results average
        $scope.getResultsAverage = function () {
            var avg = 0;
            if ($scope.game.estimate && $scope.game.estimate.results) {
                // here, if the deck has an specific calculation, use it
                var sum = 0;
                angular.forEach($scope.game.estimate.results, function (result) {
                    if (result.points && angular.isNumber(result.points)) {
                        sum += result.points;
                    }
                });
                avg = Math.ceil(sum / $scope.game.estimate.results.length);
                if ($scope.decks[$scope.game.deck.id] && $scope.decks[$scope.game.deck.id].average) {
                    avg = $scope[$scope.decks[$scope.game.deck.id].average](avg);
                }
            }
            return avg;
        };

        // Get total of active participants
        $scope.totalOfOnlineParticipants = function () {
            var totalOfOnlineParticipants = 0;
            if ($scope.game && $scope.game.participants) {
                angular.forEach($scope.game.participants, function (participant) {
                    if (participant.online === true && participant.active === true) {
                        totalOfOnlineParticipants++;
                    }
                });
            }
            return totalOfOnlineParticipants;
        };

        // Get total of observers
        $scope.totalOfObservers = function () {
            var totalOfOnlineParticipants = 0;
            if ($scope.game && $scope.game.participants) {
                angular.forEach($scope.game.participants, function (participant) {
                    if (participant.online === true && participant.active === false) {
                        totalOfOnlineParticipants++;
                    }
                });
            }
            return totalOfOnlineParticipants;
        };

        // Accept
        $scope.acceptRound = function () {
            $scope.game.estimate.points = $scope.newEstimate.points;
            $scope.game.estimate.endedAt = new Date().getTime();
            $scope.game.estimate.status = 'closed';
            $scope.game.stories[$scope.game.estimate.id] = angular.copy($scope.game.estimate);
            $scope.game.estimate = false;
            angular.forEach($scope.game.participants, function (participant) {
                participant.hasVoted = false;
            });
        };

        // Play again
        $scope.playAgain = function () {
            $scope.game.estimate.results = [];
            $scope.game.estimate.status = 'active';
            angular.forEach($scope.game.participants, function (participant) {
                participant.hasVoted = false;
            });
        };

        // Cancel round
        $scope.cancelRound = function () {
            if ($scope.game.estimate) {
                var idx = $scope.game.estimate.id;
                $scope.game.stories[idx].startedAt = false;
                $scope.game.stories[idx].endedAt = false;
                $scope.game.stories[idx].status = 'queue';
                $scope.game.estimate = false;
                angular.forEach($scope.game.participants, function (participant) {
                    participant.hasVoted = false;
                });
            }
        };

        // Reveal cards
        $scope.revealCards = function () {
            $scope.game.estimate.status = 'reveal';
        };

        // Set Defaults
        $scope.newGame = { deck: $scope.decks[1] };
        $scope.showCardDeck = true;
        $scope.showSelectEstimate = false;
        $scope.disablePlayAgainAndRevealButtons = false;
        $scope.showCards = false;

        // Set card deck visibility
        $scope.setShowCardDeck = function () {
            $scope.showCardDeck = true;
            if ($scope.game.estimate && $scope.game.estimate.results) {
                angular.forEach($scope.game.estimate.results, function (result) {
                    if (
                        result &&
                        result.user &&
                        result.user.id &&
                        result.user.id === $scope.fp.user.id
                    ) {
                        $scope.showCardDeck = false;
                    }
                });
            }
        };

        // Set estimation form visibility
        $scope.setShowSelectEstimate = function () {
            $scope.showSelectEstimate = false;
            if (
                $scope.game.estimate &&
                $scope.game.owner &&
                (
                    $scope.game.owner.id === $scope.fp.user.id
                )
            ) {
                $scope.showSelectEstimate = true;
            }
        };

        // Set new estimate average points
        $scope.setNewEstimate = function () {
            $scope.newEstimate = { points: $scope.getResultsAverage() };
        };

        // Disable play again and reveal buttons if results are empty
        $scope.setDisablePlayAgainAndRevealButtons = function () {
            if (!$scope.game.estimate) {
                return;
            }

            if (!$scope.game.estimate.results || $scope.game.estimate.results.length === 0) {
                $scope.disablePlayAgainAndRevealButtons = true;
            } else {
                $scope.disablePlayAgainAndRevealButtons = false;
            }
        };

        // Show cards?
        $scope.setShowCards = function () {
            $scope.showCards = false;
            if ($scope.game.estimate.status === 'reveal') {
                $scope.showCards = true;
            } else if (
                $scope.game.estimate &&
                $scope.game.estimate.results &&
                $scope.game.estimate.results.length &&
                $scope.game.estimate.results.length >= $scope.totalOfOnlineParticipants() &&
                $scope.allVotersVoted()
            ) {
                $scope.showCards = true;
            }
        };

        // seek non-voted voters
        $scope.allVotersVoted = function () {
            var voted = true;
            angular.forEach($scope.game.participants, function (participant) {
                if (participant.online === true && participant.active === true && participant.hasVoted !== true) {
                    voted = false;
                }
            });

            return voted;
        };

        // Set unestimated stories count
        $scope.setUnestimatedStoryCount = function () {
            $scope.unestimatedStoriesCount = 0;
            angular.forEach($scope.game.stories, function (story) {
                if (story.status === 'queue') {
                    $scope.unestimatedStoriesCount++;
                }
            });
        };

        // Logout
        $scope.logout = function () {
            $cookieStore.remove('fp');
            $location.path('/');
            $location.replace();
        };

        // syncs the db with storage
        $scope.syncFp = function () {
            $scope.fp.user = $scope.game.participants[$scope.fp.user.id];
            $cookieStore.put('fp', $scope.fp);
        };

        // Redirect with a GID to create new games
        $scope.redirectToCreateNewGame();

        // Redirect to set fullname if empty
        $scope.redirectToSetFullnameIfEmpty();

        // Redirect to game if fullname already set
        $scope.redirectToGameIfFullnameAlreadySet();

        // Load game and register presence
        $scope.loadGame();

        // Update view on game changes
        $scope.$watch('game', function (game) {
            if (!game) {
                return;
            }
            $scope.setShowCardDeck();
            $scope.setShowSelectEstimate();
            $scope.setShowCheckmarks();
            $scope.setNewEstimate();
            $scope.setDisablePlayAgainAndRevealButtons();
            $scope.setShowCards();
            $scope.setUnestimatedStoryCount();
            $scope.syncFp();
        });

    });
