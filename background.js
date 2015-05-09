chrome.runtime.onConnect.addListener(function(conn) {
    conn.onMessage.addListener(function(msg) {
        console.log(msg);
        if (msg.websiteID) {
            var xhr = new XMLHttpRequest();
            xhr.onreadystatechange = function() {
                if (this.readyState == 4) {
                    if (this.status == 200) {
                        conn.postMessage({squad: this.responseText});
                    } else {
                        console.log(this);
                    }
                }
            };
            xhr.open('GET', 'http://seagull.corp.skyscanner.local/service_delivery/get_squad_from_websiteID_json?websiteID=' + msg.websiteID, true);
            xhr.send();
        }
    });
});

