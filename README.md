# ember-cli-mix-build

A new ember app building for mix project structure.


## Features

- a mix project structure like pods
- support nested app source
- integrate lintTree in development for ember-cli > 3.17
- add custom watch directories in development

### mix project structure

```
.
├── .
├── .
├── -app(common)
│   ├── components
│   │   └── x-table
│   │       ├── component.js
│   │       └── template.hbs
│   ├── services
│   │   ├── realtime.js
│   │   └── ajax.js
│   ├── helpers
│   ├── utils
│   ├── models
├── .
├── app-express(like pods)
│   ├── components
│   │   └── news-rolling
│   │       ├── component.js
│   │       └── template.hbs
│   ├── components-demo
│   │   └── news-rolling
│   │       ├── component.js
│   │       └── template.hbs
│   ├── routes
│   │   ├── login
│   │   │   ├── route.js
│   │   │   ├── template.hbs
│   │   │   └── controller.js
│   │   └── index
│   │       ├── route.js
│   │       └── template.hbs
│   ├── services
│   │   ├── setting.js
│   │   └── tone.js
│   └── styles
│       └── app.css
│   └── public
│       └── sound
├── [build.js]
├── app-advance
│   └── ...
├── config
├── public
└── ember-cli-build.js
```


### the rule of nested app source

`trees.app`:

> when setup build,  environment flag: `APP_PROJECT` is required!
> `APP_PROJECT=app-express ember serve`

```
[source]                                                           [target]
 │                                                                  │
 ├─ /app                  ┐                                         │
 │                        ├─   MergePlugin({overwrite: true})   --> └─ /app
 └─ /app-express        ──┘

```

`trees.public`:

```
[source]                                                              [target]
 │                                                                     │
 ├─ /sound                   ┐                                         │
 │                           ├─ MergeLikePlugin({overwrite: true}) --> └─ /(empty)
 └─ /__ext__/brand1/-sound ──┘
```

### todo

- [ ] build optimize sourcemaps
- [ ] ember server startup multi-project
- [ ] ember parallel build
