import useStore from './store/useStore'
import SimpleApp from './simple/SimpleApp'
import AdvancedApp from './AdvancedApp'

export default function App() {
  const { simpleMode } = useStore()
  return simpleMode ? <SimpleApp /> : <AdvancedApp />
}
