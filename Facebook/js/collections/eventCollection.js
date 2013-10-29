define(['backbone', 'models/eventModel'], 

    function(Backbone, Event){
    
    var EventCollection = Backbone.Collection.extend({

        model: Event,

        initialize: function () {
            this.levels = [];
        },

        positionLevel: function (events, level) {
            var earliestTime = 0;
            this.levels[level] = []

            // filter the events for only events at current level and aren't positioned yet
            var filteredEvents = _.filter(events, function (event) {
                return event.priority == level && !event.isPositioned;
            })

            while(filteredEvents.length){

                // Grab earliest event at this level
                var eventInScope = _.min(filteredEvents, function (event) {
                    return event.get('start');
                });

                // Find overlapping events
                var overlappingEvents = _.filter(filteredEvents, function (event) {
                    return  event.get('start') >= eventInScope.get('start') 
                            && event.get('start') <= eventInScope.get('end')
                            && event.cid != eventInScope.cid;
                });

                // Change all overlapped events to the next level
                _.each(overlappingEvents, function (event) {
                    event.priority += 1;
                });

                // Set current event to positioned
                eventInScope.isPositioned = true;

                // Push the event to the right level matrix, to optimizing searching through levels later
                this.levels[level].push(eventInScope);

                // Set earliest time to our event's end time
                earliestTime = eventInScope.get('end');

                // refilter the events and repeat the process til there are none
                var filteredEvents = _.filter(events, function (event) {
                    return event.priority == level && !event.isPositioned;
                });
            }

            events = events.filter(function(event){
                return event.priority > level;
            });

            // If we still have events, recursively run through the remaining events at the next level
            if(events.length){
                this.positionLevel(events, level + 1)
            } else {
                // If there are no more events, we've placed all of them. Set the swim lane count and
                // set exposures for any elements that have a lot of trailing space to maximize the calendar use.
                this.swimLaneCount = level + 1;
                this.setExposures();
            }
            
        },

        setExposures: function () {
            // Some elements are the furthest right, but have empty space to the right of them.
            // We need to increase their exposure to fill the empty space on the calendar
            // Let's look through every event, and check if there is an event to its immediate right,
            // if there is, skip it. If not, check to see if its priority is equal to the number of swim lanes,
            // if not, increase its exposure to make up for the gap.
            var that = this;

            for(var i = 0; i < this.levels.length; i++){
                // Level deep
                for(var z = 0; z < this.levels[i].length; z++){
                    // Event at level
                    var event = this.levels[i][z],
                        start = event.get('start'),
                        end = event.get('end');


                    var borderingEvents = _.filter(this.levels[i+1], function(border){
                        return that.checkBorders(border, start, end);
                    });

                    console.log(i,z, borderingEvents);
                    if(borderingEvents.length == 0){
                        // There's nothing to the immediate right, but may be something further down restricting our size,
                        // we need to keep checking for more things to the further right.

                        // Special case, second to last one...
                        if(i + 2 == this.levels.length){
                            event.exposure = 2;
                        } else {
                            for(var x = i + 2; x < this.levels.length; x++ ){
                                borderingEvents = _.filter(this.levels[x], function(border){
                                    return that.checkBorders(border, start, end);
                                });

                                if(borderingEvents.length > 0 || x == this.swimLaneCount - 1){
                                    if(x >= this.swimLaneCount - 1){
                                        event.exposure = borderingEvents.length ? this.swimLaneCount - event.priority - 1 : this.swimLaneCount - event.priority;    
                                    } else {
                                        event.exposure = x - i;
                                    }
                                    break;
                                }
                            }
                        }                        
                    }

                    // Fixes a bug
                    if(event.exposure + event.priority > this.swimLaneCount){
                        console.log('uh oh')
                        // event.exposure = this.swimLaneCount - event.priority;
                    }

                }
            }
        },

        checkBorders: function (border, start, end) {
            var borderStart = border.get('start'),
                borderEnd = border.get('end');

            return  (borderEnd > start && borderEnd < end) ||
                    (borderStart > start && borderStart < end) ||
                    (borderStart < start && borderEnd > end) ||
                    borderStart == start ||
                    borderEnd == end;
        },

        // The goal of this function is figure out what events are overlapping, set all of the events proper heights
        // and starting positions (height and top), and then organize the events into swim lanes so none are overlapping 
        analyzeCollection: function (calendarOptions) {
            this.calendarOptions = calendarOptions;
            this.minutesInCalendar = this.getMinutesInCalendar(calendarOptions.startTime, calendarOptions.endTime); 

            var heightPerMinute,
                that = this;

            heightPerMinute = calendarOptions.container.height / this.minutesInCalendar;            
            
            this.each(function (event) {
                event.height = (Math.round((event.get('end') - event.get('start')) * heightPerMinute)) - calendarOptions.eventVerticalBorder;
                event.top = Math.round(heightPerMinute * event.get('start'));
            });
            
            var level = 0;

            var events = this.filter(function(event){
                return event.priority == level;
            });

            this.positionLevel(events, level);

        },

        getSwimLaneCount: function () {
            return this.swimLaneCount;
        },

        getMinutesInCalendar: function (start, end) {
            return ((end / 100) - (start / 100)) * 60;
        }

    });

    return EventCollection;

});