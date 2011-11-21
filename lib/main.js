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
    id: "ardupad",
    label: "Ardupad Widget",
    contentURL: "http://ardupad.cc/ardupad-icon.png",
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
		    // replace this is mkstemp() like function
		    var filename = "/tmp/foobar";
		    var arduino_version = "atmega328p";
		    var arduino_port = "/dev/ttyUSB3";

		    var file_pointer = datei.open(filename, "w");
		    file_pointer.write(response.text);
		    file_pointer.close();

		    var result = system("avrdude" +
					" -C/usr/share/arduino/hardware/tools/avrdude.conf -q -q" +
					" -p" + arduino_version +
					" -carduino " +
					" -P" + arduino_port +
					" -b57600 -D " +
					" -Uflash:w:" + filename + ":i"
				       );

		}
	    }).get();

    }
});

console.log("The add-on is running.");
