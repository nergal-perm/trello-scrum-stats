let apiConfig = {};
let sprints = [];

/**
 * Document setup: loads configuration and all the sprints metadata,
 * sets up web page layout (very primitive, though) and assigns handler
 * to `formatType` checkbox
 */
$(document).ready(function() {
    loadSprintDataUsingSavedConfig();
    $(".markdown").hide();
    $(".html").show();                        
    $("#formatType").change(
        function(){
            $(".markdown").toggle();
            $(".html").toggle();
        });
});

/**
 * Loads configuration from `config` folder, then delegates to
 * `getAllTheSprints` function to asquire sprints metadata.
 */
function loadSprintDataUsingSavedConfig() {
    $.getJSON( "config/config.json", function( data ) {
        fillApiConfigWithData(data);
        getAllTheSprints();
    });
}

/**
 * Fills `apiConfig` (empty object stored in a global variable) with
 * sensitive data (api tokens and so on) from config files.
 * 
 * @param {Object} data 
 */
function fillApiConfigWithData(data) {
    $.each( data, function( key, val ) {
        apiConfig[key] = val;
    });
}

/**
 * Populates global sprints array and creates options for the web page dropdown
 */
function getAllTheSprints() {
    let { sprintsListID, apiKey, apiToken } = apiConfig;
    var url = `https://api.trello.com/1/lists/${sprintsListID}/cards?key=${apiKey}` + 
              `&token=${apiToken}&fields=name,id&customFieldItems=true`;
    $.getJSON(url, function (data) {
        var items = [];
        $.each(data, function(item) {
            var sprint = getSprintDataFrom(data[item]);
            if (sprint.id !== undefined) {
                items.push( "<option value='" + sprint.id + "'>" + sprint.name + "</option>" );
            }

            sprints.push(sprint);
        });
        $( "#sprintSelect").html(items.join(""));
    });
}

/**
 * Parses provided `TrelloCard` and creates valid Sprint object based on that card
 * custom fields
 * 
 * @param {Object} sprintCard 
 * @returns {Object} sprint general info
 */
function getSprintDataFrom(sprintCard) {
    var sprint = {};
    sprintCard.customFieldItems.forEach(function(customField) {
        switch(customField.idCustomField) {
            case apiConfig.customFieldSprintID: 
                sprint.id = customField.value.text;
                break;
            case apiConfig.customFieldSprintNumber:
                sprint.number = customField.value.number;
                break;
            case apiConfig.customFieldSprintStartDate:
                sprint.startDate = treatAsUTC(customField.value.date);
                break;
            case apiConfig.customFieldSprintEndDate:
                sprint.endDate = treatAsUTC(customField.value.date);
                break;                             
        }
    });
    sprint.name = sprintCard.name;
    return sprint;
}

/**
 * Called by pressing a button on a web page. Starts the whole process of 
 * creating the sprint report. 
 * 
 * @returns 
 */
function createSprintReport() {
    var sprintId = $("#sprintSelect").val();
    var sprint = getSprintById(sprintId);
    if (sprint === null) {  
        alert("Sprint not found");
        return;
    }
    var url = `https://api.trello.com/1/boards/${sprintId}/cards?key=${apiConfig.apiKey}` +
              `&token=${apiConfig.apiToken}&fields=name,dueComplete,due,labels,desc&customFieldItems=true`;
    $.getJSON(url, function (data) {
        var burnout = createBurnoutTemplate(sprint);
        var promise = new Promise(function (resolve, reject) {
            var stats = calculateCardStats(data, sprint, burnout);
            resolve(stats);
        });
        promise.then(function(stats) {
            calculateBurnoutStats(burnout, stats.sprintPlannedPoints);
            clearPage();
            $("<p/>", {
                html: "Очков на спринт (план): <strong>" + stats.sprintPlannedPoints.toFixed(2) + "</strong><br/>" +
                        "Всего очков на спринт: <strong>" + stats.sprintEstimatedPoints.toFixed(2) + "</strong><br/>" +
                        "Реализовано очков: <strong>" + stats.sprintRealPoints.toFixed(2) + "</strong>"
                }).appendTo( "#details");
            outputArtifactsData(stats.artifacts, burnout, stats.sprintPlannedPoints);                
        });
        promise.catch(function(error) {
            console.log(JSON.stringify(error));
        });
    });            
}

function calculateCardStats(data, sprint, burnout) {
    var stats = {
        sprintPlannedPoints: 0,
        sprintEstimatedPoints: 0,
        sprintRealPoints: 0,
        artifacts: [],
        labels: {}
    };
    var sprintCustomFields = getCustomFieldsFor(sprint.id);
    data.forEach(function(item, index, array) {
        var card = createCardFrom(item, sprintCustomFields, sprint);
        // since sprint 2 Tasks are deprecated, using stories instead
        var storiesSinceSprintTwo = (card.type === "Story" && Number.parseInt(sprint.number) >= 2);
        var tasksBeforeSprintTwo = (card.type === "Task" && Number.parseInt(sprint.number) < 2);
        console.log(card, storiesSinceSprintTwo, tasksBeforeSprintTwo);
        if ( tasksBeforeSprintTwo || storiesSinceSprintTwo ) {
            // TODO: check if a card has a label at all
            var statLabel = {};
            if (!stats.labels.hasOwnProperty(card.label.id)) {
                statLabel = {
                    name: card.label.name,
                    color: card.label.color,
                    plannedTasks: 0,
                    allTasks: 0,
                    doneTasks: 0,
                    plannedPoints: 0,
                    allPoints: 0,
                    donePoints: 0,
                    plannedHours: 0,
                    workedHours: 0
                }
                stats.labels[card.label.id] = statLabel;
            } else {
                statLabel = stats.labels[card.label.id];
            }

            statLabel.allTasks += 1;
            statLabel.allPoints += card.pointsEstimated;
            statLabel.plannedHours += card.hoursEstimated;

            if (card.isPlanned) {
                stats.sprintPlannedPoints += card.pointsEstimated;
                statLabel.plannedTasks += 1;
                statLabel.plannedPoints += card.pointsEstimated;
            }
            stats.sprintEstimatedPoints += card.pointsEstimated;
            burnout[card.dayCreated].realPointsLeft += card.pointsEstimated;
            if (card.isCompleted) {
                burnout[card.dayCompleted].realHoursDone += card.hoursReal;
                burnout[card.dayCompleted].realPointsDone += card.pointsEstimated;
                stats.sprintRealPoints += card.pointsEstimated;
                statLabel.doneTasks += 1;
                statLabel.donePoints += card.pointsEstimated;
                statLabel.workedHours += card.hoursReal;
            }
            if (storiesSinceSprintTwo && card.type === "Story") {
                stats.artifacts.push(card);
            }
        } else if (card.type !== undefined){
            stats.artifacts.push(card);
        }
    });
    console.log("Returning from calculateCardStats\n" + JSON.stringify(stats));
    return stats;   
}


function clearPage() {
    $("#goal").children().html("");
    $("#retro").children().html("");
    $("#dailies").children().html("");
    $("#details").html("");         
}

function outputArtifactsData(artifacts, burnout, plannedPoints) {
    var dailiesHtml = ["<h1>Ежедневный scrum</h1>"];
    var dailiesMarkdown = ["<p><pre>## Ежедневный scrum\n"];
    var storiesHtml = [];
    var storiesMarkdown = [];
    var goalHtml = "";
    var goalMarkdown = "";
    var converter = new showdown.Converter();
    artifacts.forEach(function(artifact) {
        switch(artifact.type) {
            case "Goal":
                goalHtml ="<h1>Цель спринта</h1><p>" + converter.makeHtml(artifact.desc) + "</p>" + 
                    "<h2>Реализуемые истории:</h2><ul>";
                goalMarkdown = "<p><pre>__Цель спринта:__\n\n&gt; " + artifact.desc + "\n\n__Реализуемые истории__\n\n";
                break;
            case "Retro":
                $("#retro > .html").html("<h1>Ретроспектива</h1><p>" + converter.makeHtml(artifact.desc) + "</p>");
                $("#retro > .markdown").html("<p><pre>__Итог спринта__:\n\n" + artifact.desc + "</pre></p>");
                break;
            case "Daily":
                var pointsStat = getPointsStatFor(artifact.dayCompleted, burnout, plannedPoints);
                dailiesHtml.push("<h2>Дата: " + pointsStat + "</h2><p>" + 
                    converter.makeHtml(artifact.desc) + "</p>");
                dailiesMarkdown.push("__Дата: " + pointsStat + "__\n");
                dailiesMarkdown.push(artifact.desc + "\n");
                break;
            case "Story":
                if (artifact.isCompleted) {
                    storiesHtml.push("<li><del>" + artifact.name + "</del></li>");
                    storiesMarkdown.push("* `[x]` " + artifact.name + "\n");
                } else {
                    storiesHtml.push("<li>" + artifact.name + "</li>");
                    storiesMarkdown.push("* `[ ]` " + artifact.name + "\n");
                }

        }
    });
    dailiesMarkdown.push("</pre></p>");
    storiesMarkdown.push("</pre></p>");
    storiesHtml.unshift(goalHtml);
    storiesMarkdown.unshift(goalMarkdown);
    $("#goal > .html").html(storiesHtml.join(""));
    $("#goal > .markdown").html(storiesMarkdown.join(""));
    $("#dailies > .markdown").html(dailiesMarkdown.join("\n"));
    $("#dailies > .html").html(dailiesHtml.join(""));
}

function getPointsStatFor(day, burnout, plannedPoints) {
    var options = { year: 'numeric', month: 'numeric', day: 'numeric' };
    var result = "";
    if (burnout[day]) {
        var today  = burnout[day].date;
        result = today.toLocaleDateString("ru-RU", options) + " Осталось очков: ";

        if (day === 0) {
            result += plannedPoints + "/" + plannedPoints;
        } else {
            result += burnout[day-1].realPointsLeft + "/" + burnout[day-1].idealPointsLeft;
        }
    }
    return result;
}

function getCustomFieldsFor(sprintId) {
    var url = "https://api.trello.com/1/boards/" + sprintId + "/customFields" + 
        "?key=" + apiConfig.apiKey + "&token=" + apiConfig.apiToken;
        var result = {};
        $.getJSON(url, function (response) {
            $.each(response, function(index) {
                switch(response[index].name) {
                    case "Created": 
                        result.created = response[index].id;
                        break;
                    case "Story Points":
                        result.storyPoints = response[index].id;
                        break;
                    case "Scrum Type":
                        result.scrumType = response[index].id;
                        response[index].options.forEach(function(option) {
                            result[option.id] = option.value.text;
                        });
                        break;  
                }
            });
        });
    return result;
}

function createCardFrom(cardData, sprintCustomFields, sprint) {
    if (typeof(cardData) === "object") {
        var card = {};

        var estHoursRegex = /\(([\d|\.]*)\)/g;
        if (cardData.name.search(estHoursRegex) > -1) {
            card.type = "Task";
            var result = estHoursRegex.exec(cardData.name);
            card.hoursEstimated = Number.parseFloat(result[1]);
            cardData.name = cardData.name.replace(estHoursRegex, "").trim();
        }

        var realHoursRegex = /\[([\d|\.]*)\]/g;
        if (cardData.name.search(realHoursRegex) > -1) {
            var result = realHoursRegex.exec(cardData.name);
            card.hoursReal = Number.parseFloat(result[1]);;
            cardData.name = cardData.name.replace(realHoursRegex, "").trim();
        }

        card.name = cardData.name;
        card.isCompleted = !!cardData.dueComplete;
        if (card.isCompleted === true) {
            card.dayCompleted = getDaysBetween(treatAsUTC(cardData.due), sprint.startDate);
        }
        card.isPlanned = true;
        cardData.customFieldItems.forEach(function(item) {
            switch(item.idCustomField) {
                case sprintCustomFields.created:
                    card.isPlanned = false;
                    card.dayCreated = getDaysBetween(treatAsUTC(item.value.date), sprint.startDate);
                    break;
                case sprintCustomFields.storyPoints:
                    card.pointsEstimated = Number.parseFloat(item.value.number);
                    break;
                case sprintCustomFields.scrumType:
                    card.type = sprintCustomFields[item.idValue];
                    card.desc = cardData.desc;
                    break;
            }
        });
        if (cardData.labels.length > 0) {
            card.label = cardData.labels[0];
        }
        if(card.isPlanned) {
            card.dayCreated = 0;
        }

        return card;
    } else {
        return null;
    }
}

function createBurnoutTemplate(sprint) {
    var daysInSprint = getDaysBetween(sprint.endDate, sprint.startDate) + 1;
    var result = new Array(daysInSprint);
    for (var i=0; i<daysInSprint; i++) {
        
        result[i] = {
            "date": addDays(sprint.startDate, i),
            "idealPointsLeft": 0,
            "realPointsLeft": 0,
            "realPointsDone": 0,
            "realHoursDone": 0
        };
    }
    return result;
}

function addDays(date, days) {
    var dat = new Date(date);
    dat.setDate(dat.getDate() + days);
    return dat;
}

function getDaysBetween(date1, date2) {
    var millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.floor((date1 - date2) / millisecondsPerDay);            
}

function calculateBurnoutStats(burnout, sprintPlannedPoints) {
    var idealBurnoutPerDay = sprintPlannedPoints / burnout.length;
    burnout.forEach(function(day, index, array) {
        day.idealPointsLeft = Math.round(sprintPlannedPoints - idealBurnoutPerDay * (index + 1));
        if (index === 0) {
            day.realPointsLeft = day.realPointsLeft - day.realPointsDone;
        } else {
            day.realPointsLeft = array[index-1].realPointsLeft + day.realPointsLeft - day.realPointsDone;
            day.realPointsDone += array[index-1].realPointsDone;
            day.realHoursDone += array[index-1].realHoursDone;
        }
    });
    return burnout;
}

function treatAsUTC(date) {
    var result = new Date(Date.parse(date));
    result.setMinutes(result.getMinutes() - result.getTimezoneOffset());
    return result;
}

function getSprintById(sprintId) {
    var result = null;
    sprints.forEach(function(sprint) {
        if (sprint.id === sprintId) {
            result = sprint;
        }
    });
    return result;
}