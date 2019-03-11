#!/usr/bin/env node

'use strict'

// READ THIS //
// IN ORDER TO RUN THIS SCRIPT DOWNLOAD NODE JS FROM WEBSITE AND CODE EDITOR 
// SUCH AS VISUAL STUDIO CODE

// IMPORTING REQUIRED MODULES NEEDED IN ORDER TO RUN THE SCRIPTS 
// THESE NEED TO BE INSTALLED BEFORE THE SCRIPT CAN BE RAN USING NPM INSTALL
// NPM WILL BE INSTALLED WITH NODE 
// SHOULD BE ABLE TO TYPE 'npm install' FOLLOWED BY NAME OF MODULE IN BRACKETS IN TERMINAL
const Koa = require('koa')
const Router = require('koa-router')
const views = require('koa-views')
const staticDir = require('koa-static')
const bodyParser = require('koa-bodyparser')
const session = require('koa-session')
const sqlite = require('sqlite-async')

// DEFINING THE APP AND ROUTER 
const app = new Koa()
const router = new Router()

//CONFIGURING MIDDLEWARE
app.keys = ['darkSecret']
app.use(staticDir('public'))
app.use(bodyParser())
app.use(session(app))

// WE ARE USING THE HANDLEBARS EXTENSION INSTEAD OF .HTML 
app.use(views(`${__dirname}/views`, { extension: 'handlebars' }, {map: { handlebars: 'handlebars' }}))

// DEFINING THE LOCAL PORT 
const port = 8080

// THIS IS THE BASE ROUTE THAT WE WILL ACCESS WHEN TYPING 'localhost:8080' INTO THE URL
router.get('/', async ctx => {
	// EXECUTES THE TRY BLOCK IF THIS FAILS THEN THE CATCH BLOCK DEALS WITH THE ERRORS
	// WHEN ACCESSING THE BASE ROUTE IF THE SESSION IS NOT AUTHORISED IT AUTOMATICALLY
	// REDIRECTS THE USER TO THE LOGIN PAGE, WITH A MESSAGE TELLING THEM TO LOGIN 
	// FOR A SESSION TO BE AUTHORISED A COOKIE HAS TO BE CREATED THIS IS NOT POSSIBLE 
	// UNLESS THE USER IS ALREADY LOGGED IN  
	try {
		if(ctx.session.authorised !== true ) return ctx.redirect('/login?msg=You%20need%20to%20log%20in.')
		const data = {}
		if(ctx.query.msg) data.msg = ctx.query.msg
		await ctx.render('index')
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

// USING GET METHOD IN ORDER TO RENDER THE LOGIN PAGE 
router.get('/login', async ctx => {
	const data = {}
	if(ctx.query.msg) data.msg = ctx.query.msg
	if(ctx.query.user) data.user = ctx.query.user
	await ctx.render('login', data)
})

//USING THE POST METHOD TO CONNECT TO THE DATABASE AND LOG THE USER IN 
router.post('/login', async ctx => {
	try {
		const body = ctx.request.body
		const db = await sqlite.open('./realworld.db')
		//CHECKING THE USERNAME, IF THERE IS A COUNT OF 1 IN THE DATABASE THE USERNAME EXSISTS  
		const records = await db.get(`SELECT count(id) AS count FROM users WHERE user="${body.user}";`)
		// IF COUNT=0 THE USERNAME DOES NOT EXSIST WITHIN THE DATABASE 
		if(!records.count) ctx.redirect('/login?msg=Invalid%20username,%20please%20try%20again.') 
		// RETRIVING THE PASSWORD THAT IS STORED WITHIN THE DATABASE WHERE IS IS == TO USER INPUT
		const record = await db.get(`SELECT pass FROM users WHERE user = "${body.user}";`)
		// CLOSE THE DATABASE 
		await db.close()
		//CHECKING IF THE PASSWORD ENTERED IN THE LOGIN IS == TO THE ONE STORED IN THE DATABASE
		if (body.pass!==record.pass) return ctx.redirect(`/login?user=${body.user}&msg=Invalid%20password,%20please%20try%20again.`)
		// VALID USERNAME AND PASSWORD
		// SESSION IS AUTHORISED SO A COOKIE IS CREATED 
		ctx.session.authorised = true
		// REDIRECTS THE USER TO THE HOMEPAGE 
		return ctx.redirect('/?msg=You%20are%20now%20logged%20in...')
	} catch(err) {
		// CATCHES ERRORS
		await ctx.render('error', {message: err.message})
	}
})

// LOGOUT ROUTE, USED WHEN THE USER CLICKS ON THE LOGOUT BUTTON ON THE HOME PAGE 
router.get('/logout', async ctx => {
	//LOGGING THE USER OUT AND DELETING THE COOKIE - ENDING THE SESSION 
	ctx.session.authorised = null 
	// REDIRECTING TO THE LOGIN PAGE WIH A MESSAGE TELLING THE USER THEY HAVE LOGGED OUT
	ctx.redirect('/login?msg=You%20are%20now%20logged%20out.')
})

// DEFINING ROUTES AND CREATING DATABASE 
// DATABASE WILL NOT BE INCLUDED IN GITHUB UPLOAD AS IT IS WITHIN THE .gitgnore 
// DATABASE CREATED WHEN 'node index.js' IS RAN IN THE TERMINAL AND 
app.use(router.routes())
module.exports = app.listen(port, async() => {
	// MAKE SURE WE HAVE A DATABASE WITH THE CORRECT SCHEMA
	const db = await sqlite.open('./realworld.db')
	await db.run('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, user TEXT, pass TEXT);')
	await db.close()
	console.log(`listening on port ${port}`)
})
