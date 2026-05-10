import React from 'react'
import ReactDOM from 'react-dom/client'
import {
  Chart as ChartJS,
  BarController,
  CategoryScale, LinearScale, TimeScale,
  LineController,
  PointElement, LineElement, BarElement,
  Filler, Tooltip, Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import 'chartjs-adapter-date-fns'
import App from './App'
import './styles/index.css'

ChartJS.register(
  LineController, BarController,
  CategoryScale, LinearScale, TimeScale,
  PointElement, LineElement, BarElement,
  Filler, Tooltip, Legend, annotationPlugin,
)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
