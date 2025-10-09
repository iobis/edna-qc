import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Form, Spinner, Alert, Badge } from 'react-bootstrap';
import './App.css';

function App() {
  const [data, setData] = useState([]);
  const [asvsData, setAsvsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('density');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load both results and ASVs data
        const [resultsResponse, asvsResponse] = await Promise.all([
          fetch('/output/scandola/results.json'),
          fetch('/output/scandola/asvs.json')
        ]);

        if (!resultsResponse.ok || !asvsResponse.ok) {
          throw new Error('Failed to load data');
        }

        const [resultsData, asvsData] = await Promise.all([
          resultsResponse.json(),
          asvsResponse.json()
        ]);

        setData(resultsData);
        setAsvsData(asvsData);
        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleSort = (field) => {
    const direction = sortField === field && sortDirection === 'asc' ? 'desc' : 'asc';
    setSortField(field);
    setSortDirection(direction);
  };

  const toggleRowExpansion = (taxonID) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(taxonID)) {
      newExpandedRows.delete(taxonID);
    } else {
      newExpandedRows.add(taxonID);
    }
    setExpandedRows(newExpandedRows);
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;
    
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const filteredData = sortedData.filter(item =>
    item.scientificName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num) => {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
  };

  if (loading) {
    return (
      <div className="App">
        <Container className="d-flex justify-content-center align-items-center" style={{ minHeight: '100vh' }}>
          <div className="text-center">
            <Spinner animation="border" role="status" className="mb-3">
              <span className="visually-hidden">Loading...</span>
            </Spinner>
            <div>Loading data...</div>
          </div>
        </Container>
      </div>
    );
  }

  if (error) {
    return (
      <div className="App">
        <Container className="mt-5">
          <Alert variant="danger">
            <Alert.Heading>Error Loading Data</Alert.Heading>
            <p>{error}</p>
          </Alert>
        </Container>
      </div>
    );
  }

  return (
    <div className="App">
      <Container fluid className="py-4">
        <Row>
          <Col>
            <h1 className="display-4 mb-4">eDNA QC Results</h1>
            <Row className="align-items-center">
              <Col md={6}>
                <Form.Control
                  type="text"
                  placeholder="Search by scientific name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="mb-3 mb-md-0"
                />
              </Col>
              <Col md={6} className="text-md-end">
                <Badge bg="light" text="dark" className="fs-6">
                  Showing {filteredData.length} of {data.length} records
                </Badge>
              </Col>
            </Row>
          </Col>
        </Row>
      </Container>
      
      <Container fluid className="py-4">
        <Row>
          <Col>
            <Table responsive className="mb-0">
              <thead>
                <tr>
                  <th 
                    onClick={() => handleSort('scientificName')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Scientific Name {sortField === 'scientificName' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('taxonID')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Taxon ID {sortField === 'taxonID' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('decimalLongitude')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Longitude {sortField === 'decimalLongitude' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('decimalLatitude')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Latitude {sortField === 'decimalLatitude' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('density')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Density {sortField === 'density' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('suitability')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Suitability {sortField === 'suitability' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th 
                    onClick={() => handleSort('cells')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Cells {sortField === 'cells' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((item, index) => {
                  const isExpanded = expandedRows.has(item.taxonID);
                  const taxonAsvs = asvsData[item.taxonID] || {};
                  const coordinatePairs = Object.keys(taxonAsvs);
                  const totalSequences = Object.values(taxonAsvs).reduce((sum, sequences) => sum + sequences.length, 0);
                  
                  return (
                    <React.Fragment key={index}>
                      <tr>
                        <td 
                          className="fw-bold text-primary"
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleRowExpansion(item.taxonID)}
                        >
                          {item.scientificName}
                          <span className="ms-2">
                            {isExpanded ? '▼' : '▶'}
                          </span>
                        </td>
                        <td>
                          <a 
                            href={`https://obisnew.obis.org/taxon/${item.taxonID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                          >
                            {formatNumber(item.taxonID)}
                          </a>
                        </td>
                        <td>{formatNumber(item.decimalLongitude)}</td>
                        <td>{formatNumber(item.decimalLatitude)}</td>
                        <td>{formatNumber(item.density)}</td>
                        <td>{formatNumber(item.suitability)}</td>
                        <td>{formatNumber(item.cells)}</td>
                      </tr>
                      {isExpanded && coordinatePairs.length > 0 && (
                        <tr>
                          <td colSpan="7" className="bg-light">
                            <div className="p-3">
                              <h6 className="mb-3">
                                ASVs for {item.scientificName} ({coordinatePairs.length} coordinate pairs, {totalSequences} total sequences)
                              </h6>
                              <div className="row">
                                {coordinatePairs.map((coordinatePair) => {
                                  const [longitude, latitude] = coordinatePair.split('_');
                                  const sequences = taxonAsvs[coordinatePair];
                                  
                                  return (
                                    <div key={coordinatePair} className="col-12 mb-4">
                                      <div className="card">
                                        <div className="card-header d-flex justify-content-between align-items-center">
                                          <div>
                                            <strong>Coordinates: {parseFloat(longitude).toFixed(5)}, {parseFloat(latitude).toFixed(5)}</strong>
                                            <small className="text-muted ms-2">({sequences.length} sequences)</small>
                                          </div>
                                        </div>
                                        <div className="card-body">
                                          <div className="row">
                                            {sequences.map((sequence, seqIndex) => (
                                              <div key={seqIndex} className="col-md-6 col-lg-4 mb-3">
                                                <div className="border rounded p-2 bg-light">
                                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                                    <small className="text-muted fw-bold">Sequence {seqIndex + 1}</small>
                                                    <small className="text-muted">{sequence.length} bp</small>
                                                  </div>
                                                  <code className="small d-block" style={{ wordBreak: 'break-all', fontSize: '0.7rem', lineHeight: '1.1' }}>
                                                    {sequence}
                                                  </code>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && coordinatePairs.length === 0 && (
                        <tr>
                          <td colSpan="7" className="bg-light">
                            <div className="p-3 text-muted">
                              <em>No ASVs found for this taxon</em>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </Table>
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default App;
