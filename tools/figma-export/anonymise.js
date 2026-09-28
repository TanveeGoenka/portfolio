// Placeholder names for the Lexafide case study: real people, firms, insurers and contact details in the
// design text are replaced with "Party 01", "Client Firm A", +1 555-01XX (applied by build.js, `anonymise: true`).
// Order matters: full names before first names / surnames.
const pad = n => String(n).padStart(2, '0');
const B = String.raw`\b`;
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const parties = ['Anirban Bhui', 'Ineerban Hui', 'Amitrban Bhul', 'Tejas Sarvankar', 'Marcus Holloway', 'Marcus Lee', 'Marcus Chen', 'Marcus Johnson', 'Michael Torres', 'Michael Brown', 'John Smith', 'John Doe', 'Sarah Johnson', 'Alex Morgan', 'Jessica Davis', 'David Wilson', 'David Carter', 'Mike Holder', 'Ravi Kale', 'Sarah Williams', 'Kavya Reddy', 'Priya Nair', 'Lydia Workman', 'R. Patel', 'M. Johnson', 'S. Williams', 'K. Lee', 'A. Cho', 'Jane Smith', 'Mike holder'];
const staff = ['Sarah K. Johnson', 'Sarah Mitchell', 'Sarah Kim', 'Sarah K.', 'Dana Whitfield', 'Lisa Rodriguez', 'Jake Moran', 'Michael Chen', 'Emily Davis', 'Jessica Lee', 'Olivia Bennett', 'Alex Thompson', 'Nathan Cole', 'Daniel Carter', 'Sophia Martinez', 'Robert Williams', 'Denise Park', 'Ahmad Zainy', 'Terry Dohrmann', 'Attorney Chen'];
const R = [];
parties.forEach((p, i) => R.push([new RegExp(B + escRe(p) + B, 'g'), 'Party ' + pad(i + 1)]));
staff.forEach((p, i) => R.push([new RegExp(B + escRe(p) + '(?![A-Za-z])', 'g'), 'Staff ' + pad(i + 1)]));
const firms = [['Kwartler Manus', 'Client Firm A'], ['Morgan and Morgan', 'Client Firm B'], ['Richmond Vona', 'Client Firm C'], ['Harlow & Finch LLP', 'Company E'], ['Meridian Legal Group', 'Company F'], ['Northstar Manufacturing', 'Company G'], ['Vanta Brands Inc.', 'Company H'], ['Vanta Brands', 'Company H'], ['Northeast Logistics LLC', 'Company D'], ['Northeast Logistics', 'Company D'], ['Horizon Trucking Co.', 'Company A'], ['Horizon Trucking', 'Company A'], ['Hori zon Trucking', 'Company A'], ['City Medical Transit', 'Company C'], ['Progressive Commercial', 'Insurer A'], ['Progressive', 'Insurer A'], ['Allstate', 'Insurer B'], ['Hartford', 'Insurer C'], ['FedEx', 'delivery company'], ['UPMC Medical Records', 'Provider A Records'], ['UPMC', 'Provider A'], ['SF General', 'Hospital A'], ['PL Hospital', 'Hospital B'], ['Peachtree St, Atlanta', 'Street A'], ['Peachtree', 'Street A'], ['I‑95', 'Highway 1'], ['I-95', 'Highway 1'], ['I-880', 'Highway 2'], ['Claude Sonnet 5', 'AI model'], ['Claude models', 'AI models'], ['Anthropic provider', 'Model provider'], ['Anthropic', 'Model provider'], ['zenafide', 'firm']];
firms.forEach(([a, b]) => R.push([new RegExp(escRe(a), 'g'), b]));
// first names / surnames left over (case titles, greetings, chat)
const singles = [['Torres', 'Party 09'], ['Sarvankar', 'Party 04'], ['Patel', 'Party 22'], ['Williams', 'Party 20'], ['Johnson', 'Party 25'], ['Bhul', 'Party 03'], ['Holloway', 'Party 05'], ['Bhui', 'Party 01'], ['Tejas', 'Staff 21'], ['Arnav', 'Staff 22'], ['Anirban', 'Party 01'], ['Josh', 'Staff 23'], ['Marcus', 'Party 06'], ['Michael', 'Party 09'], ['Sarah', 'Staff 04'], ['Jake', 'Staff 07'], ['Lisa', 'Staff 06'], ['Rob', 'Staff 24'], ['Maya', 'Staff 25'], ['Tanvee', 'Party 30'], ['Kaushal', 'Staff 26'], ['Terry', 'Staff 19'], ['Olivia', 'Staff 11'], ['Denise', 'Staff 17'], ['Rachel', 'Staff 27'], ['John', 'Party 13'], ['holloway', 'party 05']];
singles.forEach(([a, b]) => R.push([new RegExp(B + a + B, 'g'), b]));
R.push([new RegExp(B + 'Alex(?! Morgan)' + B, 'g'), 'Party 14']);
R.push([/\bDoe v\./g, 'Party 12 v.']);
// contact details
R.push([/[A-Za-z0-9._+-]+@(gmail\.com|flame\.edu\.in|firm\.com|lexafide\.com)/g, 'name@firm.example']);
R.push([/[A-Za-z0-9._+-]+@\s*$/g, 'name@']);
R.push([/^\s*g?mail\s*\.\s*com\s*$/g, 'firm.example']);
let k = 0; const phone = () => '+1 555-01' + pad((k++ % 90) + 10);
R.push([/\+1 \(\d{3}\)-\d{3}-\d{4}/g, phone]);
R.push([/\+1 \(\d{3}\) \d{3}[‑-]\d{4}/g, phone]);
R.push([/\+?1? ?\(?\d{3}\)?[ -]\d{3}-\d{4}/g, phone]);
R.push([/\+91 ?\d{3} ?\d{3} ?\d{4}|\+91 ?\d{5} ?\d{5}|\+9\d{11}/g, phone]);
R.push([/\+1\d{10,11}\b/g, phone]);
module.exports = R;
