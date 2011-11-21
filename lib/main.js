const widgets = require("widget");
const tabs = require("tabs");
const datei = require("file");
const request = require("request");

widgets.Widget({
    id: "widgetID1",
    label: "My Arduino Widge",
    contentURL: "http://www.mozilla.org/favicon.ico",
    onClick: function(event) {

        var pad_url;
        for each (var tab in tabs) {
            if (tab == tabs.activeTab)
                pad_url = tab.url;
        }

    var Request = request.Request;
    var latestTweetRequest = Request({
        url: "http://www.sealabs.net/media/hello.hex",
        onComplete: function (response) {
            fp = datei.open("/tmp/foobar", "w");
            fp.write(response.text);
            fp.close();
        }
    }).get();

    }
});


console.log("The add-on is running.");
