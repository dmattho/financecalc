import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// --- Constants based on Philippine Regulations (2024) ---
const SSS_RATE = 0.045;
const SSS_MAX_SALARY_CREDIT = 30000;

const PHILHEALTH_RATE = 0.05; // Total premium, employee share is 2.5%
const PHILHEALTH_MIN_SALARY = 10000;
const PHILHEALTH_MAX_SALARY = 100000;

const PAGIBIG_RATE = 0.02;
const PAGIBIG_MAX_CONTRIBUTION_SALARY = 10000;

// Annual Tax Brackets (TRAIN Law)
const TAX_BRACKETS = [
  { lower: 0, upper: 250000, rate: 0, base: 0 },
  { lower: 250000, upper: 400000, rate: 0.15, base: 0 },
  { lower: 400000, upper: 800000, rate: 0.20, base: 22500 },
  { lower: 800000, upper: 2000000, rate: 0.25, base: 102500 },
  { lower: 2000000, upper: 8000000, rate: 0.30, base: 402500 },
  { lower: 8000000, upper: Infinity, rate: 0.35, base: 2202500 },
];

const initialPersonState = {
    name: 'Person 1',
    grossIncome: 30000,
    incomeType: 'monthly',
    taxableAllowance: 0,
    nonTaxableAllowance: 0,
    applyGovBenefits: true,
    applyNightDiff: false,
    nightDiffHoursPerDay: 2,
    nightDiffRate: 10,
};

// FIX: Define interfaces for the financial data to provide strong typing.
interface PersonFinancials {
    monthlyGross: number;
    nightDiffPay: number;
    taxableAllowance: number;
    nonTaxableAllowance: number;
    totalGross: number;
    sss: number;
    philhealth: number;
    pagibig: number;
    totalContributions: number;
    taxableIncome: number;
    withholdingTax: number;
    totalDeductions: number;
    netIncome: number;
}

interface FinancialsState {
  person1: Partial<PersonFinancials>;
  person2: Partial<PersonFinancials>;
  household: { netIncome?: number };
}

const App = () => {
  // --- STATE MANAGEMENT ---
  const [mode, setMode] = useState('individual'); // 'individual' or 'couple'
  const [person1, setPerson1] = useState(initialPersonState);
  const [person2, setPerson2] = useState({ ...initialPersonState, name: 'Person 2', grossIncome: 25000 });

  const [expenses, setExpenses] = useState([
    { id: 1, name: 'Rent / Mortgage', amount: 0, assignedTo: 'equitable' },
    { id: 2, name: 'Utilities (Water, Elec.)', amount: 0, assignedTo: 'equal' },
  ]);

  // FIX: Apply the FinancialsState type to the useState hook. This resolves errors where properties were accessed on an object typed as '{}'.
  const [financials, setFinancials] = useState<FinancialsState>({
      person1: {},
      person2: {},
      household: {},
  });

  // --- CALCULATION LOGIC ---
  const calculateFinancialsForPerson = (personState): PersonFinancials => {
    const { grossIncome, incomeType, applyGovBenefits, applyNightDiff, nightDiffHoursPerDay, nightDiffRate, taxableAllowance, nonTaxableAllowance } = personState;
    
    const monthlyGross = incomeType === 'yearly' ? grossIncome / 12 : grossIncome;
    const workingDaysPerMonth = 22; // Standard assumption

    // Night Differential
    const hourlyRate = (monthlyGross / workingDaysPerMonth) / 8;
    const totalMonthlyNightHours = nightDiffHoursPerDay * workingDaysPerMonth;
    const nightDiffPay = applyNightDiff ? hourlyRate * (nightDiffRate / 100) * totalMonthlyNightHours : 0;
    
    // Total Gross for display
    const totalGross = monthlyGross + nightDiffPay + taxableAllowance + nonTaxableAllowance;

    // Government Contributions (based on basic salary)
    const sss = applyGovBenefits ? Math.min(monthlyGross, SSS_MAX_SALARY_CREDIT) * SSS_RATE : 0;
    
    const philhealthSalaryBase = Math.max(PHILHEALTH_MIN_SALARY, Math.min(monthlyGross, PHILHEALTH_MAX_SALARY));
    const philhealth = applyGovBenefits ? (philhealthSalaryBase * PHILHEALTH_RATE) / 2 : 0;
    
    const pagibigSalaryBase = Math.min(monthlyGross, PAGIBIG_MAX_CONTRIBUTION_SALARY);
    const pagibig = applyGovBenefits ? pagibigSalaryBase * PAGIBIG_RATE : 0;
    
    const totalContributions = sss + philhealth + pagibig;

    // Income Tax
    const grossTaxableIncome = monthlyGross + nightDiffPay + taxableAllowance;
    const annualTaxableIncome = (grossTaxableIncome - totalContributions) * 12;
    let annualTax = 0;
    const bracket = TAX_BRACKETS.find(b => annualTaxableIncome > b.lower && annualTaxableIncome <= b.upper);
    
    if (bracket && annualTaxableIncome > 250000) {
        annualTax = bracket.base + (annualTaxableIncome - bracket.lower) * bracket.rate;
    }

    const withholdingTax = applyGovBenefits ? annualTax / 12 : 0;
    const totalDeductions = totalContributions + withholdingTax;
    const netIncome = totalGross - totalDeductions;

    return {
      monthlyGross, nightDiffPay, taxableAllowance, nonTaxableAllowance, totalGross, sss, philhealth, pagibig,
      totalContributions, taxableIncome: grossTaxableIncome - totalContributions,
      withholdingTax, totalDeductions, netIncome
    };
  };

  useEffect(() => {
    const person1Financials = calculateFinancialsForPerson(person1);
    
    if (mode === 'individual') {
      setFinancials({ person1: person1Financials, person2: {}, household: { netIncome: person1Financials.netIncome } });
    } else {
      const person2Financials = calculateFinancialsForPerson(person2);
      const householdNetIncome = person1Financials.netIncome + person2Financials.netIncome;
      setFinancials({ person1: person1Financials, person2: person2Financials, household: { netIncome: householdNetIncome } });
    }
  }, [person1, person2, mode]);


  // --- HANDLERS ---
  const handlePersonChange = (person, field, value) => {
    if (person === 1) {
      setPerson1(prev => ({ ...prev, [field]: value }));
    } else {
      setPerson2(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleAddExpense = () => {
    setExpenses([...expenses, { id: Date.now(), name: '', amount: 0, assignedTo: 'equal' }]);
  };

  const handleRemoveExpense = (id) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  const handleExpenseChange = (id, field, value) => {
    setExpenses(expenses.map(e => e.id === id ? { ...e, [field]: value } : e));
  };

  // --- DERIVED STATE & CALCULATIONS ---
  const totalExpenses = expenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const householdNetIncome = financials.household?.netIncome || 0;
  const remainingBalance = householdNetIncome - totalExpenses;

  // Granular expense calculation for Couple Mode
  const person1Net = financials.person1?.netIncome || 0;
  const person2Net = financials.person2?.netIncome || 0;

  const person1ContributionPercent = householdNetIncome > 0 ? (person1Net / householdNetIncome) : 0;
  const person2ContributionPercent = householdNetIncome > 0 ? (person2Net / householdNetIncome) : 0;
  
  let person1IndividualExpenses = 0;
  let person2IndividualExpenses = 0;
  let person1SharedContribution = 0;
  let person2SharedContribution = 0;

  expenses.forEach(expense => {
      const amount = Number(expense.amount || 0);
      switch (expense.assignedTo) {
          case 'person1':
              person1IndividualExpenses += amount;
              break;
          case 'person2':
              person2IndividualExpenses += amount;
              break;
          case 'equal':
              person1SharedContribution += amount / 2;
              person2SharedContribution += amount / 2;
              break;
          case 'equitable':
              person1SharedContribution += amount * person1ContributionPercent;
              person2SharedContribution += amount * person2ContributionPercent;
              break;
          default:
              break;
      }
  });


  const person1TotalResponsibility = person1IndividualExpenses + person1SharedContribution;
  const person2TotalResponsibility = person2IndividualExpenses + person2SharedContribution;

  const person1Remaining = person1Net - person1TotalResponsibility;
  const person2Remaining = person2Net - person2TotalResponsibility;


  // --- HELPER ---
  const formatCurrency = (value) => `₱ ${Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // --- RENDER ---
  
  const renderPersonInputs = (personNum, personState) => (
    <div className="person-input-section">
      <div className="form-group">
        <label htmlFor={`name${personNum}`}>Name</label>
        <input type="text" id={`name${personNum}`} value={personState.name} onChange={e => handlePersonChange(personNum, 'name', e.target.value)} placeholder={`e.g., Alex`}/>
      </div>
      <div className="form-group">
        <label htmlFor={`grossIncome${personNum}`}>Gross Income</label>
        <div className="input-group">
          <input type="number" id={`grossIncome${personNum}`} value={personState.grossIncome} onChange={e => handlePersonChange(personNum, 'grossIncome', Number(e.target.value))} placeholder="e.g., 30000"/>
          <select value={personState.incomeType} onChange={e => handlePersonChange(personNum, 'incomeType', e.target.value)}>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor={`taxableAllowance${personNum}`}>Taxable Allowance (Monthly)</label>
        <input type="number" id={`taxableAllowance${personNum}`} value={personState.taxableAllowance} onChange={e => handlePersonChange(personNum, 'taxableAllowance', Number(e.target.value))} placeholder="e.g., 1000"/>
      </div>
      <div className="form-group">
        <label htmlFor={`nonTaxableAllowance${personNum}`}>Non-Taxable Allowance (Monthly)</label>
        <input type="number" id={`nonTaxableAllowance${personNum}`} value={personState.nonTaxableAllowance} onChange={e => handlePersonChange(personNum, 'nonTaxableAllowance', Number(e.target.value))} placeholder="e.g., 2000"/>
      </div>
      <div className="form-group">
          <div className="toggle-group">
              <label htmlFor={`govBenefits${personNum}`}>Apply Government Benefits/Taxes?</label>
              <label className="switch">
                  <input type="checkbox" id={`govBenefits${personNum}`} checked={personState.applyGovBenefits} onChange={e => handlePersonChange(personNum, 'applyGovBenefits', e.target.checked)} />
                  <span className="slider"></span>
              </label>
          </div>
      </div>
      <div className="form-group">
          <div className="toggle-group">
              <label htmlFor={`nightDiff${personNum}`}>Night Differential?</label>
                <label className="switch">
                  <input type="checkbox" id={`nightDiff${personNum}`} checked={personState.applyNightDiff} onChange={e => handlePersonChange(personNum, 'applyNightDiff', e.target.checked)} />
                  <span className="slider"></span>
              </label>
          </div>
          {personState.applyNightDiff && (
              <div className="night-diff-inputs">
                  <div className="form-group">
                      <label htmlFor={`nightDiffHours${personNum}`}>Hours per day</label>
                      <input type="number" id={`nightDiffHours${personNum}`} value={personState.nightDiffHoursPerDay} onChange={e => handlePersonChange(personNum, 'nightDiffHoursPerDay', Number(e.target.value))} placeholder="e.g., 2"/>
                  </div>
                  <div className="form-group">
                      <label htmlFor={`nightDiffRate${personNum}`}>Rate (%)</label>
                      <input type="number" id={`nightDiffRate${personNum}`} value={personState.nightDiffRate} onChange={e => handlePersonChange(personNum, 'nightDiffRate', Number(e.target.value))} placeholder="e.g., 10"/>
                  </div>
              </div>
          )}
      </div>
    </div>
  );

  return (
    <>
      <header className="main-header">
        <h1>Philippine Financial Forecaster</h1>
        <p>Plan your income, deductions, and budget with ease.</p>
        <div className="mode-selector">
          <button className={mode === 'individual' ? 'active' : ''} onClick={() => setMode('individual')}>Individual</button>
          <button className={mode === 'couple' ? 'active' : ''} onClick={() => setMode('couple')}>Couple</button>
        </div>
      </header>

      <div className={`card card-input ${mode === 'couple' ? 'couple-mode' : ''}`}>
        <h2 className="card-header">Income & Deductions</h2>
        <div className="input-container">
          {renderPersonInputs(1, person1)}
          {mode === 'couple' && renderPersonInputs(2, person2)}
        </div>
      </div>

      <div className="card card-summary">
        <h2 className="card-header">Financial Summary</h2>
        {mode === 'individual' ? (
          <>
            <div className="summary-grid">
              {/* FIX: Use optional chaining (?.) for safe property access on financials state to prevent runtime errors. */}
              <span className="summary-label">Gross Monthly Income</span>
              <span className="summary-value">{formatCurrency(financials.person1?.monthlyGross)}</span>
              <span className="summary-label">Night Differential Pay</span>
              <span className="summary-value">{formatCurrency(financials.person1?.nightDiffPay)}</span>
              <span className="summary-label">Taxable Allowance</span>
              <span className="summary-value">{formatCurrency(financials.person1?.taxableAllowance)}</span>
              <span className="summary-label">Non-Taxable Allowance</span>
              <span className="summary-value">{formatCurrency(financials.person1?.nonTaxableAllowance)}</span>
              <span className="summary-label total-row">Total Gross Income</span>
              <span className="summary-value total-row">{formatCurrency(financials.person1?.totalGross)}</span>
              <span className="summary-label">Deductions:</span>
              <span></span>
              <span className="summary-label deduction">SSS Contribution</span>
              <span className="summary-value">{formatCurrency(financials.person1?.sss)}</span>
              <span className="summary-label deduction">PhilHealth Contribution</span>
              <span className="summary-value">{formatCurrency(financials.person1?.philhealth)}</span>
              <span className="summary-label deduction">Pag-IBIG Contribution</span>
              <span className="summary-value">{formatCurrency(financials.person1?.pagibig)}</span>
              <span className="summary-label deduction">Withholding Tax</span>
              <span className="summary-value">{formatCurrency(financials.person1?.withholdingTax)}</span>
              <span className="summary-label total-row">Total Deductions</span>
              <span className="summary-value total-row">{formatCurrency(financials.person1?.totalDeductions)}</span>
            </div>
            <div className="net-income">
              <span className="summary-label">Net Take-Home Pay (Monthly)</span>
              <span className="summary-value">{formatCurrency(financials.person1?.netIncome)}</span>
            </div>
          </>
        ) : (
          <>
            <div className="summary-grid couple-summary">
                {/* FIX: Use optional chaining (?.) for safe property access on financials state to prevent runtime errors. */}
                <span className="summary-label">{person1.name}'s Net Pay</span>
                <span className="summary-value">{formatCurrency(financials.person1?.netIncome)}</span>
                <span className="summary-label">{person2.name}'s Net Pay</span>
                <span className="summary-value">{formatCurrency(financials.person2?.netIncome)}</span>
            </div>
            <div className="net-income">
                <span className="summary-label">Total Household Net Income (Monthly)</span>
                <span className="summary-value">{formatCurrency(householdNetIncome)}</span>
            </div>
          </>
        )}
      </div>
      
      <div className="card card-budget">
        <h2 className="card-header">50/30/20 Budget Rule</h2>
        <div className="budget-container">
            <div className="budget-item">
                <h3>50% Needs</h3>
                <p>{formatCurrency(householdNetIncome * 0.5)}</p>
                <small>Housing, Bills, Groceries</small>
            </div>
             <div className="budget-item">
                <h3>30% Wants</h3>
                <p>{formatCurrency(householdNetIncome * 0.3)}</p>
                <small>Hobbies, Dining, Shopping</small>
            </div>
             <div className="budget-item">
                <h3>20% Savings</h3>
                <p>{formatCurrency(householdNetIncome * 0.2)}</p>
                <small>Investments, Debt, Savings</small>
            </div>
        </div>
      </div>

      <div className="card card-emergency">
        <h2 className="card-header">6-Month Emergency Fund</h2>
        <div className="emergency-fund-container">
            <p className="emergency-fund-description">
                A safety net for unexpected events. Aim to save 6 times your total monthly expenses.
            </p>
            <div className="emergency-fund-details">
                <div className="emergency-fund-item">
                    <h3>Target Goal</h3>
                    <p>{formatCurrency(totalExpenses * 6)}</p>
                    <small>Based on your {mode === 'couple' ? 'household' : 'current'} monthly expenses</small>
                </div>
                <div className="emergency-fund-item">
                    <h3>Suggested Contribution</h3>
                    <p>{formatCurrency(householdNetIncome * 0.2)}</p>
                    <small>From your 20% savings allocation</small>
                </div>
            </div>
        </div>
      </div>

      <div className="card card-spending">
        <h2 className="card-header">Monthly Bills & Spending Tracker</h2>
        <div className="expense-list">
          {expenses.map(expense => (
            <div key={expense.id} className="expense-item">
              <input type="text" placeholder="Expense Name" value={expense.name} onChange={e => handleExpenseChange(expense.id, 'name', e.target.value)} />
              <input type="number" placeholder="Amount" value={expense.amount} onChange={e => handleExpenseChange(expense.id, 'amount', e.target.value)} />
              {mode === 'couple' && (
                <select value={expense.assignedTo} onChange={e => handleExpenseChange(expense.id, 'assignedTo', e.target.value)}>
                  <option value="equitable">Shared (Equitable)</option>
                  <option value="equal">Shared (Equal)</option>
                  <option value="person1">{person1.name}</option>
                  <option value="person2">{person2.name}</option>
                </select>
              )}
              <button className="btn-remove" onClick={() => handleRemoveExpense(expense.id)} aria-label="Remove Expense">&times;</button>
            </div>
          ))}
        </div>
        <button className="btn-add" onClick={handleAddExpense}>Add Expense</button>
        <div className="spending-summary">
            <span>Total Expenses:</span>
            <span>{formatCurrency(totalExpenses)}</span>
        </div>
        {mode === 'individual' ? (
             <div className="spending-summary">
                <span>Remaining Balance:</span>
                <span className={remainingBalance >= 0 ? 'remaining-positive' : 'remaining-negative'}>
                    {formatCurrency(remainingBalance)}
                </span>
            </div>
        ) : (
            <div className="couple-final-summary">
                <div className="summary-item">
                    <span className="summary-label">{person1.name}'s Responsibility</span>
                    <span className="summary-value">{formatCurrency(person1TotalResponsibility)}</span>
                    <small>({formatCurrency(person1IndividualExpenses)} individual + {formatCurrency(person1SharedContribution)} shared)</small>
                </div>
                 <div className="summary-item">
                    <span className="summary-label">{person2.name}'s Responsibility</span>
                    <span className="summary-value">{formatCurrency(person2TotalResponsibility)}</span>
                    <small>({formatCurrency(person2IndividualExpenses)} individual + {formatCurrency(person2SharedContribution)} shared)</small>
                </div>
                 <div className="summary-item final-balance">
                    <span className="summary-label">{person1.name}'s Remaining</span>
                    <span className={`summary-value ${person1Remaining >= 0 ? 'remaining-positive' : 'remaining-negative'}`}>{formatCurrency(person1Remaining)}</span>
                </div>
                 <div className="summary-item final-balance">
                    <span className="summary-label">{person2.name}'s Remaining</span>
                    <span className={`summary-value ${person2Remaining >= 0 ? 'remaining-positive' : 'remaining-negative'}`}>{formatCurrency(person2Remaining)}</span>
                </div>
                 <div className="summary-item total-row">
                    <span className="summary-label">Household Remaining Balance</span>
                    <span className={`summary-value ${remainingBalance >= 0 ? 'remaining-positive' : 'remaining-negative'}`}>{formatCurrency(remainingBalance)}</span>
                </div>
            </div>
        )}
      </div>
    </>
  );
};

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);