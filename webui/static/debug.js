// vim: set et sw=2 ts=2 sts=2 ff=unix fenc=utf8:
// Author: Binux<i@binux.me>
//         http://binux.me
// Created on 2014-02-23 15:19:19


window.Debugger = (function() {
  var tmp_div = $('<div>');
  function escape(text) {
    return tmp_div.text(text).html();
  }

  return {
    init: function() {
      //init resizer
      $(".debug-panel:not(:first)").splitter().data('splitter').trigger('init');

      //codemirror
      CodeMirror.keyMap.basic.Tab = 'indentMore';
      this.init_python_editor($("#python-editor"));
      this.init_task_editor($("#task-editor"));
      this.bind_debug_tabs();
      this.bind_run();
      this.bind_save();
      this.bind_others();
    },

    init_python_editor: function($el) {
      var cm = this.python_editor = CodeMirror($el[0], {
        value: script_content,
        mode: "python",
        indentUnit: 4,
        lineWrapping: true,
        styleActiveLine: true,
        autofocus: true
      });
      cm.on('focus', function() {
        $el.addClass("focus");
      });
      cm.on('blur', function() {
        $el.removeClass("focus");
      });
    },

    auto_format: function(cm) {
      var pos = cm.getCursor(true);
      CodeMirror.commands.selectAll(cm);
      cm.autoFormatRange(cm.getCursor(true), cm.getCursor(false));
      cm.setCursor(pos);
    },

    format_string: function(value, mode) {
      var div = document.createElement('div');
      var cm = CodeMirror(div, {
        value: value,
        mode: mode
      });
      this.auto_format(cm);
      return cm.getDoc().getValue();
    },

    init_task_editor: function($el) {
      var cm = this.task_editor = CodeMirror($el[0], {
        value: task_content,
        mode: "application/json",
        indentUnit: 2,
        lineWrapping: true,
        styleActiveLine: true
      });
      this.auto_format(cm);
      cm.on('focus', function() {
        $el.addClass("focus");
      });
      cm.on('blur', function() {
        $el.removeClass("focus");
      });
    },

    bind_debug_tabs: function() {
      var _this = this;
      $('#tab-control > li').on('click', function() {
        $('#tab-control > li').removeClass('active');
        var name = $(this).addClass('active').data('id');
        $('#debug-tabs .tab').hide();
        $('#debug-tabs #'+name).show();
      });
      $("#tab-control li[data-id=tab-html]").on('click', function() {
        if (!!!$("#tab-html").data("format")) {
          var html_styled = "";
          CodeMirror.runMode(_this.format_string($("#tab-html pre").text(), 'text/html'), 'text/html',
                             function(text, classname) {
                               if (classname)
                                 html_styled += '<span class="cm-'+classname+'">'+escape(text)+'</span>';
                               else
                                 html_styled += escape(text);
                             });
          $("#tab-html pre").html(html_styled);
          $("#tab-html").data("format", true);
        }
      });
    },

    bind_run: function() {
      var _this = this;
      $('#run-task-btn').on('click', function() {
        _this.run();
      });
    },

    bind_save: function() {
      var _this = this;
      $('#save-task-btn').on('click', function() {
        var script = _this.python_editor.getDoc().getValue();
        $('#right-area .overlay').show();
        $.ajax({
          type: "POST",
          url: location.pathname+'/save',
          data: {
            script: script
          },
          success: function(data) {
            console.log(data);
            _this.python_log('');
            $('#right-area .overlay').hide();
          },
          error: function(xhr, textStatus, errorThrown) {
            console.log(xhr, textStatus, errorThrown);
            _this.python_log("save error!\n"+xhr.responseText);
            $('#right-area .overlay').hide();
          }
        });
      });
    },

    bind_follows: function() {
      var _this = this;
      $('.newtask').on('click', function() {
        if ($(this).next().hasClass("task-show")) {
          $(this).next().remove();
          return;
        }
        var task = $(this).after('<div class="task-show"><pre class="cm-s-default"></pre></div>').data("task");
        task = JSON.stringify(window.newtasks[task]);
        CodeMirror.runMode(_this.format_string(task, 'application/json'), 'application/json', $(this).next().find('pre')[0]);
      });
      
      $('.newtask .task-run').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        var task = $(this).parents('.newtask').data("task");
        task = JSON.stringify(window.newtasks[task]);
        _this.task_editor.setValue(_this.format_string(task, 'application/json'));
        _this.run();
      });
    },

    bind_others: function() {
      $('#python-log-show').on('click', function() {
        if ($('#python-log pre').is(":visible")) {
          $('#python-log pre').hide();
          $(this).height(8);
        } else {
          $('#python-log pre').show();
          $(this).height(0);
        }
      });
    },

    run: function() {
      var script = this.python_editor.getDoc().getValue();
      var task = this.task_editor.getDoc().getValue();
      var _this = this;

      // reset
      $("#tab-web").html('<iframe sandbox="allow-same-origin allow-scripts"></iframe>');
      $("#tab-html pre").html('');
      $('#tab-follows').html('');
      $("#tab-control li[data-id=tab-follows] .num").hide();
      $('#python-log').hide();
      $('#left-area .overlay').show();

      $.ajax({
        type: "POST",
        url: location.pathname+'/run',
        data: {
          script: script,
          task: task
        },
        success: function(data) {
          console.log(data);
          $('#left-area .overlay').hide();

          //web
          $("#tab-web").html('<iframe sandbox="allow-same-origin allow-scripts"></iframe>');
          var elem = $("#tab-web iframe");
          var doc = elem[0].contentWindow.document;
          doc.open();
          doc.write(data.fetch_result.content);
          var dotime = 0, cnt=1;
          elem[0].contentWindow.addEventListener('resize', function() {
            setTimeout(function() {
              var now = (new Date()).getTime();
              if (now > dotime && cnt > 0 && $("#tab-web iframe").height() < doc.body.scrollHeight+20) {
                $("#tab-web iframe").height(doc.body.scrollHeight+20);
                cnt--;
              }
            }, 500);
            dotime = (new Date()).getTime() + 500;
          });
          elem[0].contentWindow.addEventListener('load', function() {
            $("#tab-web iframe").height(doc.body.scrollHeight+20);
          });
          window.doc = doc;
          doc.close();
          $("#tab-control li[data-id=tab-web]").click();

          //html
          $("#tab-html pre").text(data.fetch_result.content);
          $("#tab-html").data("format", false);

          //follows
          $('#tab-follows').html('');
          elem = $("#tab-control li[data-id=tab-follows] .num");

          var newtask_template = '<div class="newtask" data-task="__task__"><span class="task-callback">__callback__</span> &gt; <span class="task-url">__url__</span><div class="task-run"><i class="fa fa-play"></i></div><div class="task-more"> <i class="fa fa-ellipsis-h"></i> </div></div>';
          if (data.follows.length > 0) {
            elem.text(data.follows.length).show();
            var all_content = "";
            window.newtasks = {};
            $.each(data.follows, function(i, task) {
              var callback = task.process;
              callback = callback && callback.callback || '__call__';
              var content = newtask_template.replace('__callback__', callback);
              content = content.replace('__url__', task.url || '<span class="error">no_url!</span>');
              all_content += content.replace('__task__', i);
              window.newtasks[i] = task;
            });
            $('#tab-follows').append(all_content);
            _this.bind_follows();
          } else {
            elem.hide();
          }

          // logs
          _this.python_log(data.logs);
        },
        error: function(xhr, textStatus, errorThrown) {
          console.log(xhr, textStatus, errorThrown);
          $('#left-area .overlay').hide();
        }
      });
    },

    python_log: function(text) {
      if (text) {
        $('#python-log pre').text(text);
        $('#python-log pre, #python-log').show();
        $('#python-log-show').height(0);
      } else {
        $('#python-log pre, #python-log').hide();
      }
    }
  };
})();

Debugger.init();
