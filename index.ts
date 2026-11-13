/**
 * Entry point for Expo
 */

import { registerRootComponent } from 'expo';
import './app/services/BackgroundLocationTask'; // defines the background task at startup
import App from './app/App';

registerRootComponent(App);
