# Marianopolis Programming Club
This repo contains the code for the Marianopolis Programming Club website, built with Svelte(Kit) and Bootstrap.

---

# Quick Guide on Maintenance

## Introduction

> [!NOTE]
> This documentation is produced after a quick first inspection of this repo, 
> feel free do correct this document if you find any problem.

Hello I'm KJI245!
If you are reading this, I assume that you are a member of the programming club, 
and you want to know the details on the maintenance of this repo.

As you can see, this repo has been built with Svelte, 
so I strongly recommand you to learn Svelte before doing any content modifications.
[Here is the offical tutorial of svelte][https://learn.svelte.dev/tutorial/welcome-to-svelte/].

## Architecture

In order to quickly modify the site, the text contents are stored in a separated file,
different from those in which contains the source code of the pages. For example: 
- Text contents are in this js file: <kbd>./src/lib/content.js</kbd>.
- Source codes of the pages are all <kbd>+page.svelte</kbd> files in <kbd>./src/routes</kbd>.

### Text Contents

In most of the cases, only the text contents of this site need modifications. For example, 
changing the academic year or droping few lines in the resources page. All these can achieved 
by just modifying the file, <kbd>./src/lib/content.js</kbd>.

In this file, you will see many blocks like this:
```javascript
export const home = {
	'metaTitle': 'Marianopolis Programming Club',
	'metaDesc': 'Welcome to the Marianopolis Programming Club!',
	'seeAlsoLinks': {
		'About the Programming Club': {
			'text': 'Learn more about the club',
			'url': '/about-us'
		},
        ...
    }
};
```
Here, each block represents the contents in page or a component. 

> [!TIP]
> Normally, you will be able to modify the contents in <kbd>./src/lib/content.js</kbd> 
> as you wish without ruining the formatting of the page. That said, it is always
> recommended that the text should be as concise as possible. 
