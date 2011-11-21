Components.utils.import("resource://gre/modules/ctypes.jsm");

const widgets = require("widget");
const tabs = require("tabs");
const datei = require("file");
const request = require("request");
const chrome = require("chrome");
const library = ctypes.open("libc.so.6");
const temp = require("temp");

var system = library.declare("system",
                             ctypes.default_abi,
			     ctypes.int,
                             ctypes.char.ptr);

var widget = widgets.Widget(
    {
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
			// craete a temporary ardupad filename
			var filename = temp.path("ardupad");
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
