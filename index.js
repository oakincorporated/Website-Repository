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

router.get('/', async ctx => {
	try {
		const data = {}
		if(ctx.session.authorised !== true ) return ctx.redirect('/login?msg=You%20need%20to%20log%20in.')
		if(ctx.query.msg) data.msg = ctx.query.msg
		if(ctx.query.user) data.user = ctx.query.user
		
		console.log(ctx.session.user)
		data.sqlquery = `SELECT * FROM attendance WHERE user="${ctx.session.user}";`
		const db = await sqlite.open('./realworld.db')
		data.profiledata = await db.get(data.sqlquery)
		await db.close()
		console.log(data.profiledata)
		await ctx.render('index', data)

	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

router.get('/login', async ctx => {
	const data = {}
	if(ctx.query.msg) data.msg = ctx.query.msg
	if(ctx.query.user) data.user = ctx.query.user
	await ctx.render('login', data)
})

router.post('/login', async ctx => {
	try {
		const body = ctx.request.body
		const db = await sqlite.open('./realworld.db')

		//username
		const records = await db.get(`SELECT count(student_id) AS count FROM users WHERE user="${body.user}";`) 
		if(!records.count) ctx.redirect('/login?msg=Invalid%20username,%20please%20try%20again.') 
		const record = await db.get(`SELECT pass FROM users WHERE user = "${body.user}";`)
		await db.close()

		//password
		if (body.pass!==record.pass) return ctx.redirect(`/login?user=${body.user}&msg=Invalid%20password,%20please%20try%20again.`)
		
		//setting cookies 
		ctx.session.authorised = true
		ctx.session.user = body.user
		console.log(ctx.session.user)

		//redirect to homepage
		return ctx.redirect(`/?msg=Welcome%20${body.user}.%20You%20are%20now%20logged%20in.`)
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

router.get('/about', async ctx => {
	const data = {}
	if(ctx.query.msg) data.msg = ctx.query.msg
	await ctx.render('about', data)
})

router.post('/about', async ctx => {
	try {
		const body = ctx.request.body 
		console.log(body)
	} catch (err) {
		await ctx.render('error', {message: err.message})
	}
})


router.get('/logout', async ctx => {
	ctx.session.authorised = null 
	ctx.redirect('/login?msg=You%20are%20now%20logged%20out.')
})


app.use(router.routes())
module.exports = app.listen(port, async() => {

	//database
	const db = await sqlite.open('./realworld.db')
	await db.run('CREATE TABLE IF NOT EXISTS users (student_id INTEGER PRIMARY KEY, user TEXT, pass TEXT);')
	await db.run('CREATE TABLE IF NOT EXISTS student (student_id INTEGER PRIMARY KEY, fname VARCHAR, mname VARCHAR, lname VARCHAR);')
	await db.run('CREATE TABLE IF NOT EXISTS attendance (student_id INTEGER PRIMARY KEY, user TEXT, present INTEGER, late INTEGER, absent INTEGER, total_classes INT);')
	await db.close()
	console.log(`listening on port ${port}`)
})