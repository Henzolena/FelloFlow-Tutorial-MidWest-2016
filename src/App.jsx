import FellowFlowTutorial from './FellowFlowTutorial.jsx'
import { LanguageProvider } from './utils/i18n/LanguageContext'

export default function App() {
  return (
    <LanguageProvider>
      <FellowFlowTutorial />
    </LanguageProvider>
  )
}
