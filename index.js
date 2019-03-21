#!/usr/bin/env node

'use strict'

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

app.use(views(`${__dirname}/views`, { extension: 'handlebars' }, {map: { handlebars: 'handlebars' }}))

const port = 8080

// THE BASE ROUTE 
router.get('/', async ctx => {
	try {
		const data = {}
		// IF THE USER IS NOT LOGGED IN REDIRECT 
		if(ctx.session.authorised !== true ) return ctx.redirect('/login?msg=You%20need%20to%20log%20in.')
		if(ctx.query.msg) data.msg = ctx.query.msg
		if(ctx.session.user) data.user = ctx.query.user
		
		
		console.log(ctx.session.user)

		// SQL QUERY USING A COOKIE TO SELECT ATTENDANCE DATA FOR EACH LOGGED IN USER
		data.sqlquery = `SELECT * FROM attendance WHERE user="${ctx.session.user}";`

		// PERFOMING SQL QUERY 
		const db = await sqlite.open('./realworld.db')

		// ASSIGNING THE QUERY TO THE DATA OBJECT 
		data.profile = await db.get(data.sqlquery)
		await db.close()

		console.log(data.profile)

		// RENDERING THE PAGE 
		await ctx.render('index', data)

	// CATCHING ANY ERRORS 
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

router.get('/login', async ctx => {
	const data = {}
	// ERROR MESSAGE THAT IS DISPLAYED TO THE USER
	if(ctx.query.msg) data.msg = ctx.query.msg
	
	// INCLUDED SO THAT THE USERNAME CAN BE PASSED BACK TO THE INPUT IF INCORRECT PASSWORD IS ENTERED
	if(ctx.query.user) data.user = ctx.query.user
	await ctx.render('login', data)
})

// THIS ROUTE IS TRIGGERED AFTER A USER SUCCESFULLY LOGS IN 
router.post('/login', async ctx => {
	try {
		const body = ctx.request.body
		const db = await sqlite.open('./realworld.db')

		// CHECKING IF THE USERNAME EXISTS
		const records = await db.get(`SELECT count(student_id) AS count FROM users WHERE user="${body.user}";`) 

		// IF USERNAME DOESNT EXIST DISPLAYING A MESSAGE TO THE USER 
		if(!records.count) ctx.redirect('/login?msg=Invalid%20username,%20please%20try%20again.') 
		
		// RETRIVING PASSWORD FROM THE DATABASE
		const record = await db.get(`SELECT pass FROM users WHERE user = "${body.user}";`)
		await db.close()

		// CHECKING IF THE PASSWORD ENTERED IS THE SAME AS STORED WITHIN THE DATABASE
		if (body.pass!==record.pass) return ctx.redirect(`/login?user=${body.user}&msg=Invalid%20password,%20please%20try%20again.`)
		
		// SETTING SESSION COOKIES 
		// SESSION.AUTHORISED - THE USER SESSION
		// SESSION.USER - THE USERNAME OF THE USER
		ctx.session.authorised = true
		ctx.session.user = body.user
		console.log(ctx.session.user)

		// REDIRECTING TO THE HOME PAGE UPON SUCESSFUL LOGIN 
		return ctx.redirect(`/?msg=Welcome%20${body.user}.%20You%20are%20now%20logged%20in.`)
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

// RENDERING THE ABOUT PAGE 
router.get('/about', async ctx => await ctx.render('about'))

router.post('/about', async ctx => {
	try {
		const body = ctx.request.body 
		console.log(body)
	} catch (err) {
		await ctx.render('error', {message: err.message})
	}
})

// THIS ROUTE IS TRIGGERED WHEN THE USER LOGS OUT 
router.get('/logout', async ctx => {

	// SETTING BOTH THE USER AUTHORISED SESSION AND THE USERNAME COOKIE TO NULL
	ctx.session.authorised = null 
	ctx.session.user = null 

	// REDIRECTING BACK TO THE LOGIN PAGE WITH A LOG OUT MESSAGE BEING DISPLAYED TO THE USER 
	ctx.redirect('/login?msg=You%20are%20now%20logged%20out.')
})


app.use(router.routes())
module.exports = app.listen(port, async() => {

	// CREATING THE SQLITE TABLES THAT ARE INCLUDED WITHIN THE DATABASE 
	const db = await sqlite.open('./realworld.db')
	await db.run('CREATE TABLE IF NOT EXISTS users (student_id INTEGER PRIMARY KEY, user TEXT, pass TEXT);')
	await db.run('CREATE TABLE IF NOT EXISTS student (student_id INTEGER PRIMARY KEY, fname VARCHAR, mname VARCHAR, lname VARCHAR);')
	await db.run('CREATE TABLE IF NOT EXISTS attendance (student_id INTEGER PRIMARY KEY, user TEXT, present INTEGER, late INTEGER, absent INTEGER, total_classes INT);')
	await db.close()
	console.log(`listening on port ${port}`)
})