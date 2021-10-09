![BirdsEye by Shengchen Zhang and Zixuan Wang](./assets/cover.png)

<h1 align="center">BirdsEye-Toio</h1>
<p align="center">Manage toio robots used in the BirdsEye project</p>
<p align="center">
  <a href="https://drive.google.com/file/d/1t6ZZkvQ8wNURpF4umpO3X2qT0VfmAlvU/view">Video preview</a> | <a href="https://github.com/shaunabanana/birdseye/issues">Share ideas</a> | <a href="https://github.com/shaunabanana/birdseye">Go to frontend code</a>
</p>

## Setting up for development
Run `npm install`.

Then, you need to compile the newest [toio.js library](https://github.com/toio/toio.js) by yourself, and add it to this project.
To do so, you need to run the following commands:
```
cd <a folder of your choice>
git clone https://github.com/toio/toio.js.git   # clone repository
cd toio.js                                      # move to repository root
yarn install                                    # install dependencies
yarn build                                      # build @toio/* packages
```

Then, you will find the compiled npm package in the `toio.js/packages` folder. There should be two folders inside, `cube` and `scanner`. Copy these two folders.

Navigate to your `node_modules` folder in this repository. If you have run `npm install`, it should be here by now. Inside it, create a folder named `@toio`, then paste the two folders you just copied inside.

Finally:

```
npm start
```

Now you're ready to go!
