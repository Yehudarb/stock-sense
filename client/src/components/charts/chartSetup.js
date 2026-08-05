import {
  Chart as ChartJS,
  BarController,
  CategoryScale,
  LinearScale,
  TimeScale,
  LineController,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import 'chartjs-adapter-date-fns'

// Chart.js is registered inside the lazy chart workspace, not the app entry.
ChartJS.register(
  LineController,
  BarController,
  CategoryScale,
  LinearScale,
  TimeScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
  Legend,
  annotationPlugin,
)

ChartJS.defaults.font.family = "'Heebo', 'Inter', system-ui, sans-serif"
