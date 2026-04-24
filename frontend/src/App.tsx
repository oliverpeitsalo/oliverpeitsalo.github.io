import './App.css'
import { Suspense } from 'react'
import { Container } from '@mui/material'
import { BrowserRouter, Route, Routes } from "react-router-dom"

import FrontPageContainer from './app/components/FrontPageContainer'

function App() {
  // const [count, setCount] = useState(0)

  return (
   <Suspense fallback="loading...">
          <BrowserRouter>
          <Container disableGutters>
            <Routes>
              <Route path="/" element= {
                <FrontPageContainer />
              }>
              </Route>
            </Routes>
          </Container>
        </BrowserRouter>
      </Suspense>
      )
}

export default App
