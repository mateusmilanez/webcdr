'use strict';

var _ = require('underscore');
var Marionette = require('marionette');

var fs = require('fs');

var User = require('./User');

var rowTemplate = fs.readFileSync(__dirname + '/row.html', 'utf8');
var tableTemplate = fs.readFileSync(__dirname + '/table.html', 'utf8');
var modalTemplate = fs.readFileSync(__dirname + '/usermodal.html', 'utf8');

var RowView = Marionette.ItemView.extend({
  tagName: 'tr',
  template: _.template(rowTemplate),
  triggers: {
    'click .js-edit': 'edit',
    'click .js-delete': 'delete'
  }
});

var GridView = Marionette.CompositeView.extend({
  tagName: 'table',
  className: 'table',
  template: _.template(tableTemplate),
  childView: RowView,
  childViewElement: 'tbody',
  onChildviewDelete: function (view) {
    this.trigger('delete', view.model);
  },
  onChildviewEdit: function (view) {
    this.trigger('edit', view.model);
  }
});

var UserModalView = Marionette.ItemView.extend({
  className: 'modal fade',
  template: _.template(modalTemplate),
  ui: {
    'id': 'input[name="id"]',
    'name': 'input[name="name"]',
    'username': 'input[name="username"]',
    'password': 'input[name="password"]',
    'acl': 'input[name="acl"]',
    'acl_in': 'input[name="acl_in"]',
    'auth_ad': 'input[name="auth_ad"]',
    'admin': 'input[name="admin"]'
  },
  events: {
    'click .js-save': 'onSave'
  },
  templateHelpers: function () {
    return {
      getTextACL: function () {
        if (this.acl) {
          return this.acl.join(',');
        } else {
          return '';
        }
      },
      id: this.model.id || '',
      title: this.title
    };
  },
  initialize: function (opts) {
    this.title = opts.title;
  },
  onSave: function () {
    var fieldValidators = {
      id: function (val) {
        return (!val) || (val == parseInt(val, 10));
      },
      name: function (val) {
        return val.length;
      },
      username: function (val) {
        return val.length;
      },
      auth_ad: function (val) {
        return true;
      },
      password: function (val, validatedFields) {
        if (validatedFields.id && val.length == 0) {
          // for existing user password may be blank
          return true;
        }
        if (validatedFields.auth_ad) {
          // no password needed for ad auth
          return true;
        }
        return val.length > 5;
      },
      acl: function (val) {
        return val.length === 0 || val.match(/^\d+(,\d*)*$/);
      },
      acl_in: function (val) {
        return true;
      },
      admin: function (val) {
        return true;
      }
    };
    var valid = true;
    var user = {};
    _.each(_.keys(fieldValidators), function (f) {
      var el = this.ui[f];
      var value;
      if (el.attr('type') == 'checkbox') {
        value = el.prop('checked');
      } else {
        value = el.val();
      }
      if (!fieldValidators[f](value, user)) {
        valid = false;
        this.ui[f].closest('.form-group').addClass('has-error');
      } else {
        user[f] = value;
        this.ui[f].closest('.form-group').removeClass('has-error');
      }
    }, this);

    if (valid) {
      if (!user.id) {
        delete user.id;
      }
      user.admin = !!parseInt(user.admin,10);
      user.acl = user.acl.length ? user.acl.split(',') : undefined;
      this.trigger('save', new User(user));
    }
  }
});

var ToolbarView = Marionette.ItemView.extend({
  template: _.template('<div class="btn btn-default js-add"><span class="glyphicon glyphicon-plus"></span> Добавить</div>'),
  triggers: {
    'click .js-add': 'add'
  }
});

var AdminView = Marionette.LayoutView.extend({
  className: 'container',
  template: _.template('<div class="toolbar"></div><div class="grid"></div>'),
  regions: {
    toolbar: '.toolbar',
    grid: '.grid'
  },
  onRender: function () {
    var toolbar = new ToolbarView();
    this.listenTo(toolbar, 'add', function () {
      this.showModal({
        title: 'Новый пользователь',
        onSave: function (user) {
          this.collection.create(user, {
            wait: true,
            success: function () {
              app.modal.hide();
            }
          });
        }
      });
    });
    this.toolbar.show(toolbar);

    var gridView = new GridView({
      collection: this.collection
    });
    this.listenTo(gridView, 'delete', this.deleteUser);
    this.listenTo(gridView, 'edit', this.editUser);
    this.grid.show(gridView);
  },
  showModal: function (opts) {
    var modalUserView = new UserModalView({
      model: opts.user || new User(),
      title: opts.title
    });
    this.listenTo(modalUserView, 'save', opts.onSave);
    app.modal.show(modalUserView);
  },
  deleteUser: function (user) {
    if (confirm('Удалить пользователя ' + user.get('name') + '?')) {
      user.destroy({wait: true});
    }
  },
  editUser: function (user) {
    var self = this;
    this.showModal({
      title: 'Изменение пользователя',
      user: user,
      onSave: function (user) {
        user.save({}, {
          success: function () {
            // XXX dirty
            self.collection.fetch({reset : true});
            app.modal.hide();
          }
        });
      }
    });
  }
});

module.exports = AdminView;
