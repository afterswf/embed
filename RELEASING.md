Releasing AfterSWF
==================

AfterSWF is published to npm as seven packages: six forks of AwayFL and AwayJS packages, and this repo.

| Package | Repo | Published from |
|---|---|---|
| `@afterswf/renderer` | [afterswf/renderer](https://github.com/afterswf/renderer) | `../renderer` |
| `@afterswf/graphics` | [afterswf/graphics](https://github.com/afterswf/graphics) | `../graphics` |
| `@afterswf/scene` | [afterswf/scene](https://github.com/afterswf/scene) | `../scene` |
| `@afterswf/avm2` | [afterswf/avm2](https://github.com/afterswf/avm2) | `../avm2` |
| `@afterswf/avm1` | [afterswf/avm1](https://github.com/afterswf/avm1) | `../avm1` |
| `@afterswf/playerglobal` | [afterswf/playerglobal](https://github.com/afterswf/playerglobal) | `../playerglobal` |
| `@afterswf/embed` | [afterswf/embed](https://github.com/afterswf/embed) | this repo |
| `@afterswf/react` | [afterswf/react](https://github.com/afterswf/react) | `../react` |

All the repos are checked out side by side, and you need to be logged in to npm (`npm whoami`) as a member of
the `afterswf` organisation.

## 1. Merge upstream changes into the forks (if there are any)

In each fork:

```sh
git checkout main
git fetch upstream
git merge upstream/dev    # resolve any conflicts, keeping our fixes
npx yarn@1 install
```

The forks follow upstream's version numbers. If `version` conflicts in `package.json`, keep whichever is
higher, ours or upstream's, so versions never go backwards. Publishing then bumps the patch version (see
below). Don't add suffixes such as `-afterswf.1`: they make pre-release versions, which sort before the
version they're based on and which version ranges such as `^0.13.325` don't match.

## 2. Test them together in embed

```sh
cd ../embed
npm install       # links the forks and builds their dist/ folders
npm run build
```

Then test against real content, e.g. the reference app described in [AGENTS.md](./AGENTS.md).

## 3. Publish the forks that changed

Every repo publishes the same way, from a clean working tree:

```sh
npm publish
git push --follow-tags
```

If the current version is already on npm, `npm publish` first bumps the patch version with
`npm version patch`, which commits and tags it (and in embed, rebuilds and commits `dist/`). A version
that isn't on npm yet, such as one you've bumped by hand (`npm version minor` for a breaking change) or one
left by a failed publish, is published as it is. `npm publish --dry-run` doesn't bump anything.

Publish the forks in dependency order, as each fork's `peerDependencies` point at the forks before it:
renderer, graphics, scene, avm2, avm1, playerglobal.

If a fork now needs a newer version of another fork, raise the minimum in its `peerDependencies` and
`devDependencies` (e.g. `"@awayjs/scene": "npm:@afterswf/scene@^0.13.326"`) before publishing it.

## 4. Publish embed

```sh
npm publish
git push --follow-tags
```

## 5. Publish the React component (if it or embed's API changed)

```sh
cd ../react
npm publish
git push --follow-tags
```

## 6. Check them

```sh
npm view @afterswf/embed version
```

New packages can take a few minutes to appear. Then try the jsDelivr examples in this repo's and the React
component's READMEs.
