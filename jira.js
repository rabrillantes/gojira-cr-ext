var conn = chrome.runtime.connect({name: 'jira'});


// Helper functions
function inject(fn) {
    var script = document.createElement('script');
    script.setAttribute('type', 'application/javascript');
    script.textContent = '(' + fn + ')();';
    document.body.appendChild(script);
}

function click(selector) {
    var e = document.querySelector(selector);
    if (e) {
        e.click();
        return e;
    }
}

function delayed_click(args) {
    var a = args.shift();
    click(a);
    if (args.length) {
        setTimeout(function() {delayed_click(args);}, 250);
    }
}

function select_option(selector, text) {
    var select = document.querySelector(selector);
    var options = select.children;
    select.value = text;
    for (var i = 0; i < options.length; i++) {
        var e = options[i];
        e.selected = false;
        if (e.innerText.trim() == text) {
            e.selected = true;
        }
    }
}


// Injects script on the actual JIRA page to inteact with it
// Use AJS (atlassian javascript) library on page to bind hotkeys
inject(function() {
    AJS.whenIType('w').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'watch'}, '*');
    });
    AJS.whenIType('`u').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'unassign'}, '*');
    });
    AJS.whenIType('`r').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'dev'}, '*');
    });
    AJS.whenIType('`a').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'analysis'}, '*');
    });
    AJS.whenIType('``').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'work'}, '*');
    });
    AJS.whenIType('`t').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'test'}, '*');
    });
    AJS.whenIType('`s').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'squad'}, '*');
    });
    AJS.whenIType('`d').execute(function() {
        window.postMessage({type: 'JIRAKEY', action: 'done'}, '*');
    });
});


// All our content script functions
function workflow(status) {
    if (document.querySelector('#status-val').innerText.trim() != status) {
        var triggers = document.querySelectorAll('.trigger-label');
        for (var i = 0; i < triggers.length; i++) {
            var e = triggers[i];
            if (e.innerText.trim() == status) {
                e.click();
            }
        }
    }
}

function toggle_watch() {
    click('#watching-toggle');
}

function unassign() {
    if (document.querySelector('#assignee-val').innerText.trim() != 'Unassigned') {
        delayed_click(['#assignee-val', '#assignee-val .drop-menu']);
        setTimeout(function() {
            document.querySelector('#assignee-suggestions li.active').classList.remove("active");
            document.querySelector('li[id^="unassigned"]').classList.add("active");
            document.querySelector('li[id^="unassigned"]').click();
            click('#assignee-val button[type="submit"]');
        }, 2000);
    }
}

function to_analysis() {
    workflow('Analysis');
    setTimeout(function() {
        click('.issueaction-assign-to-me');
    }, 1000);
}

function work_on() {
    workflow('In Progress');
    click('a.watch-state-off');
    setTimeout(function() {
        click('.issueaction-assign-to-me');
    }, 1000);
}

function to_test() {
    workflow('Ready for Test');
    setTimeout(unassign, 1000);
}

function get_squad() {
    var websiteIDs = document.querySelectorAll('#customfield_10700-val .lozenge');
    if (websiteIDs.length == 0) {
        throw 'No WebsiteIDs found. Cannot determine squad assignment.';
    }
    var websiteID = websiteIDs[0].innerText;
    if (websiteIDs.length > 1) {
        websiteID = prompt('Multiple websiteIDs found, enter id to be used:');
    }
    if (!websiteID || websiteID.length != 4) {
        throw 'Please enter a valid websiteID to assign a squad';
    }
    if (document.querySelector('#customfield_11100-val')) {
        click('#customfield_11100-val');
        conn.postMessage({websiteID: websiteID});
    } else {
        throw 'Squad selection/dropdown not visible.\n  - no current squad assigned';
    }
}

conn.onMessage.addListener(function(msg) {
    if (msg.squad) {
        conn.postMessage(msg.squad);
        assign_squad(msg.squad.replace(/"/g, ''));
    }
});

function assign_squad(squad_name) {
    select_option('#customfield_11100', squad_name);
    click('#customfield_11100-val button[type="submit"]');
}

function to_dev() {
    if (document.querySelector('#components-val').innerText == "None") {
        throw 'Please add components to this jira issue as None are currently assigned.';
    } else {
        get_squad();
        click('a.watch-state-on');
        setTimeout(function() {
            workflow('Ready for Dev');
            setTimeout(unassign, 1000);
        }, 2000);
    }
}

function to_done() {
    workflow('Done');
    setTimeout(function() {
        select_option('#resolution', 'Done');
        click('#issue-workflow-transition-submit');
    }, 2000);
}

// Map the content script functions to the names we will use to call them
var actions = {
    'watch': toggle_watch,
    'unassign': unassign,
    'analysis': to_analysis,
    'work': work_on,
    'test': to_test,
    'squad': get_squad,
    'dev': to_dev,
    'done': to_done
}

// Listen and respond to the window.postMessage by calling the above mapped functions
window.addEventListener('message', function(event) {
    if (event.data.type && (event.data.type == 'JIRAKEY')) {
        if (event.data.action) {
            try {
                conn.postMessage(event.data.action + ' hotkey triggered.');
                actions[event.data.action]();
            } catch(e) {
                alert(e);
            }
        }
    }
}, false);
