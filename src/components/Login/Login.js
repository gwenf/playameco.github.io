import React, { Component } from 'react'
import { Link } from 'react-router'

export default class Login extends Component {
  render () {
    return (
    	<div>
    		<h1>Login</h1>
    		<p>Need an account?</p>
    		<Link to='/register'>Register Here</Link>
	    </div>
    );
  }
}