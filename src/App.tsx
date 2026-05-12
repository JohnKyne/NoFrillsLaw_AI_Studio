/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Landing from './Landing';
import Dashboard from './Dashboard';
import StatutoryDeclarations from './pages/services/StatutoryDeclarations';
import Wills from './pages/services/Wills';
import LettersBeforeAction from './pages/services/LettersBeforeAction';
import SmeDebtCollection from './pages/services/SmeDebtCollection';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/services/statutory-declarations" element={<StatutoryDeclarations />} />
        <Route path="/services/wills" element={<Wills />} />
        <Route path="/services/letters-before-action" element={<LettersBeforeAction />} />
        <Route path="/services/debt-collection" element={<SmeDebtCollection />} />
        <Route path="/app/*" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
