var anologue = {
	/**
	 * Local container for the current document dataset
	 *
	 * @type Object
	 */
	db: {},

	/**
	 * Default Config
	 * 		- `id`: id of the current anologue
	 * 		- `seq`: current sequence to limit _changes requests by
	 * 		- `base`: regular domain name of the application. (i.e. `localhost`, `anologue.com`)
	 * 		- `line`: last message rendered
	 * 		- `icon`: default gravatar image url
	 * 		- `intro`: override for rendering help on page load.
	 *
	 * @type Object
	 */
	_config: {
		id: 0,
		seq: 0,
		base : null,
		line: 0,
		icon: null,
		intro: true,
	},

	/**
	 * Is shift currently pressed down?
	 *
	 * @todo move to _config?
	 * @type Boolean
	 */
	shiftDown: false,

	/**
	 * Configure and start the show!
	 *
	 * @param Object config merged into default config.
	 * @see this._config
	 */
	setup: function(config) {
		if (config.db) {
			this.db = config.db;
			config.db = undefined;
		}
		this._config = $.extend(this._config, config);
		$(".sound label").click(function() {
			anologue.toggleIcon('.sound');
		});
		$(".auto-scroll label").click(function() {
			anologue.toggleIcon('.auto-scroll');
		});
		$(".cookie label").click(function() {
			anologue.toggleIcon('.cookie');
		});
		$("#anologue-close-help").click(function() {
			anologue.closeHelp();
			return false;
		});
		$("#markdown-help").click(function() {
			anologue.markdownHelp();
			return false;
		});

		this.setupSubmit();
		this.markdown();
		this.fireworks();
		this.setupSpeaker();
		this.scout();
		this.humanizeTimes();
		this.humanizeTimesTimer();

		$('body').focusin(function() {
			anologue.resetTitle();
		});
		$('body').click(function() {
			anologue.resetTitle();
		});
	},

	fireworks: function() {
		if (this._config.intro) {
			$("#anologue-help").animate({bottom: 0}, 2500);
		} else {
			this.closeHelp();
		}
		$("#anologue-speech-bar").animate({bottom: 0}, 1500);
		$("#anologue-author").focus();
	},

	setupSubmit: function() {
		$("#anologue-form").submit(function() {
			anologue.say();
			return false;
		});
		$(document).keyup(function(key) {
			if (key.which == 16) {
				anologue.shiftDown = false;
			}
		});
		$(document).keydown(function(key) {
			if (key.which == 16) {
				anologue.shiftDown = true;
			}
		});
		$("#anologue-text").keypress(function(key) {
			if (key.which == 13) {
				if (!anologue.shiftDown) {
					anologue.say();
					return false;
				}
			}
		});
	},

	// get messages
	update: function() {
		var url = this._config.base + '/' + this._config.id + '.json?_=' + (new Date().getTime());
		$.getJSON(url, function(response) {
			if (response.status != "success") {
				return anologue.alert(response.status);
			}
			anologue.db = response.data;
			if (anologue.db.messages != null) {
				for (var i = anologue._config.line; i < anologue.db.messages.length; i++) {
					anologue.render(anologue.db.messages[i]);
					anologue._config.line++;
				}
				anologue.markdown();
			}
		});
	},

	// long poller
	scout: function() {
		var url = this._config.base
				+ '/changes/' + this._config.id + '?since=' + this._config.seq;
		$.getJSON(url, function(response) {
			if (response.status != "success") {
				return anologue.alert(response.status);
			}
			if (response.data.results.length > 0) {
				if (response.data.results[0].changes[0].rev != anologue.db.rev) {
					anologue.update();
				}
			}
			anologue._config.seq = response.data.last_seq;
			anologue.scout();
		});
	},

	// add message
	say: function() {
		this.closeHelp();
		var data = {
			author: $('#anologue-author').val(),
			email: $('#anologue-email').val(),
			text: $('#anologue-text').val(),
			scrolling: this.getOption('.auto-scroll'),
			sounds: this.getOption('.sound'),
			cookies: this.getOption('.cookie')
		}
		if (data.text == '') {
			return false;
		}
		if (data.author == '') {
			data.author = 'anonymous';
		}
		var input = $("#anologue-text").val();
		$("#anologue-text").val("");
		$.post(this._config.base + "/say/" + this._config.id, data, function(response) {
			if (response.status != 'success') {
				$("#anologue-text").val(input);
				// this might occur if someone sends an update at the same time...
				anologue.alert( 'Hold your horses, Spammy McSpamsky. Wait until your last message'
								+ 'goes through and try sending your message again.');
			}
		}, "json");

	},

	//output messages
	render: function(message) {
		var id = 'message-' + $.md5(message.timestamp + message.author);
		var html = '<li class="message" id="' + id + '" style="display:none;"><ul class="data"><li class="time"><span class="timestamp">' + message.timestamp + '</span><span class="human-time">' + this.humanizeTime(message.timestamp) + '</span></li><li class="ip">' + message.ip + '</li><li class="author"><img class="gravatar" src="http://gravatar.com/avatar/' + message.email + '?s=16&d=' + this._config.icon + '" border="0" /> <span title="' + $('<div/>').text(message.author).html() + '">' + $('<div/>').text(message.author).html() + '</span> </li><li class="text"><div class="markdown"><pre>' + $('<div/>').text(message.text).html() + '</pre></div></li></ul></li>';
		$("#anologue").append(html);

		var docTitle = message.author+' posted a new message';

		var soundDisabled = $('.anologue-settings .sound .icon').hasClass('disabled');

		var user = $('#anologue-author').val();

		if (!soundDisabled) {
			// lazy check to not trigger sound on your message
			if (message.author != user && user != '') {
				var userRegex = new RegExp(user.toLowerCase(), 'i');
				if (userRegex.test(message.text)) {
					this.hey();
					var docTitle = message.author+' mentioned you in a new message';
				}
			}
		}

		if (message.author != user) {
			this.updateTitle(docTitle);
		}

		$('#'+id).animate({
			opacity: 'show'
		}, 1000);
		var scrollEnabled = this.getOption('.auto-scroll');
		if (scrollEnabled) {
			$('html, body').animate({
				scrollTop: $('#'+id).offset().top
			}, 'normal');
		}
	},

	setupSpeaker: function() {
		if (!$.browser.msie) {
			var speaker = $("#anologue-speaker");
			speaker.attr('controls', false);
			speaker.attr('autobuffer', true);
			var tape = this._config.base + '/media/hey.mp3';
			if ($.browser.mozilla) {
				tape = this._config.base + '/media/hey.ogg';
			}
			speaker.attr('src', tape);
			this.hey();
		} else {
			$('.sound').hide();
		}
	},

	hey: function() {
		if (!$.browser.msie) {
			$('#anologue-speaker').get(0).play();
		}
	},

	alert: function(message) {
		alert(message);
		return null;
	},

	markdown: function() {
		$('.markdown').each(function() {
			if (!$(this).hasClass('marked')) {
				var showdown = new Showdown.converter();
				var text = showdown.makeHtml($(this).children('pre').html());
				$(this).html(text).addClass('marked');
				$(this).find("a").oembed(null, {
					embedMethod: 'annotate',
					maxWidth: 425,
					maxHeight: 425
				});
			}
		});
	},

	toggleIcon: function(parentClass) {
		var disabled = $('.anologue-settings '+parentClass+' .icon').hasClass('disabled');
		if (!disabled) {
			$(parentClass+' .icon').addClass('disabled');
		} else {
			$(parentClass+' .icon').removeClass('disabled');
		}
	},

	closeHelp: function() {
		if (!$("#anologue-help").hasClass('closed')) {
			$("#anologue-help").animate({bottom: '-500px'}, 1000);
			$("#anologue-help").addClass('closed');
		}
		return false;
	},

	getOption: function(parentClass) {
		var disabled = $('.anologue-settings '+parentClass+' .icon').hasClass('disabled');
		return !disabled;
	},

	humanizeTimesTimeout: null,

	humanizeTimesTimer: function() {
		clearTimeout(this.humanizeTimesTimeout);
		anologue.humanizeTimes();
		this.humanizeTimesTimeout = setTimeout(function() {
			anologue.humanizeTimesTimer();
		}, 15000);
	},

	humanizeTimes: function() {
		$('li.time').each(function() {
			var time = $(this).children('.timestamp').first().text();
			var prettyTime = anologue.humanizeTime(time);
			$(this).children('.human-time').first().text(prettyTime);
		});
	},

	humanizeTime: function(timestamp) {
		return PrettyDate.convert(timestamp);
	},

	resetTitle: function() {
		document.title = 'anologue';
	},

	updateTitle: function(msg) {
		document.title = msg + ' - anologue';
	},

	markdownHelp: function() {
		if (!$('#anologue-help .padding').hasClass("markdown-help")) {
			var html = '<h2>Markdown &nbsp;Syntax</h2> <p><strong>#heading</strong> &nbsp; &nbsp; <em>_italic_</em> &nbsp; &nbsp; <strong>**bold**</strong> &nbsp;  &nbsp; - unordered list &nbsp;  &nbsp; 1. ordered list &nbsp;  &nbsp; [a link](http://example.com/) &nbsp;  &nbsp; ![image alt text](http://example.com/image.jpg) &nbsp; &nbsp; <code>`inline code`</code></p> <pre><code>{{{ code block }}}</code></pre>';
			if (!$("#anologue-help").hasClass("closed")) {
				$("#anologue-help").animate({bottom: '-500px'}, 1000, function() {
					$("#anologue-help").addClass('closed');
					$("#anologue-help .padding").html(html).addClass("markdown-help");
					anologue.showMarkdownHelp();
				});
			} else {
				$("#anologue-help .padding").html(html).addClass("markdown-help");
				this.showMarkdownHelp();
			}
		} else {
			this.showMarkdownHelp();
		}
	},

	showMarkdownHelp: function() {
		if ($("#anologue-help").hasClass('closed')) {
			$("#anologue-help").animate({bottom: 0}, 1000, function() {
				$("#anologue-help").removeClass('closed');
			});
		} else {
			this.closeHelp();
		}
	}

}
