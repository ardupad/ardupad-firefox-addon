const widgets = require("widget");
const tabs = require("tabs");
const datei = require("file");
const request = require("request");
require("chrome");

Components.utils.import("resource://gre/modules/ctypes.jsm");

const library = ctypes.open("libc.so.6");

var system = library.declare("system",
                             ctypes.default_abi,
			     ctypes.int,
                             ctypes.char.ptr);


widgets.Widget({
    id: "widgetID1",
    label: "Ardupad Widget",
    contentURL: "http://www.mozilla.org/favicon.ico",
    onClick: function(event) {

        var pad_url;
        for each (var tab in tabs) {
            if (tab == tabs.activeTab)
                pad_url = tab.url;
        }

	var hex_request = request.Request(
	    {
		url: "http://www.sealabs.net/media/hello.hex",
		onComplete: function (response) {
		    fp = datei.open("/tmp/foobar", "w");
		    fp.write(response.text);
		    fp.close();
		    system("avrdude -C/usr/share/arduino/hardware/tools/avrdude.conf -q -q -patmega328p -carduino -P/dev/ttyUSB3 -b57600 -D -Uflash:w:/tmp/foobar:i")
		}
	    }).get();

    }
});

console.log("The add-on is running.");
