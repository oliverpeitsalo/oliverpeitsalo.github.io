import './App.css'
import { Suspense } from 'react'
import { Container } from '@mui/material'
import { BrowserRouter, Route, Routes } from "react-router-dom"

import FrontPage from './app/components/FrontPage'
import TriviaGameRoom from './app/components/TriviaRoom'
import Leaderboard from './app/components/Leaderboard'

function App() {
  // const [count, setCount] = useState(0)

  return (
   <Suspense fallback="loading...">
          <BrowserRouter>
          <Container disableGutters>
            <Routes>
              <Route path="/" element= {
                <FrontPage />
              }>
              </Route>
              <Route path="/room/:roomId" element={
                <TriviaGameRoom />
                }>
              </Route>
              <Route path="/leaderboard" element={<Leaderboard />} />
            </Routes>
          </Container>
        </BrowserRouter>
      </Suspense>
      )
}

export default App
