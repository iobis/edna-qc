import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Table, Form, Spinner, Alert, Badge, Modal, Button } from 'react-bootstrap';
import CryptoJS from 'crypto-js';
import { scaleSequential, scaleDiverging } from 'd3-scale';
import { interpolateViridis, interpolateRdBu, interpolateSpectral, interpolateOranges, interpolateBlues } from 'd3-scale-chromatic';
import './App.css';

function App() {
  const [title, setTitle] = useState("");
  const [data, setData] = useState([]);
  const [asvsData, setAsvsData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortField, setSortField] = useState('score');
  const [sortDirection, setSortDirection] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [congenericsData, setCongenericsData] = useState(null);
  const [congenericsLoading, setCongenericsLoading] = useState(false);
  const [congenericsError, setCongenericsError] = useState(null);
  const [showCongenericsModal, setShowCongenericsModal] = useState(false);
  const [selectedAsvInfo, setSelectedAsvInfo] = useState(null);

  const dataset = new URLSearchParams(window.location.search).get('dataset');

  useEffect(() => {
    const loadData = async () => {
      try {
        const [resultsResponse, asvsResponse] = await Promise.all([
          fetch(`/output/${dataset}/results.json`),
          fetch(`/output/${dataset}/asvs.json`)
        ]);

        if (!resultsResponse.ok || !asvsResponse.ok) {
          throw new Error('Failed to load data');
        }

        const [resultsData, asvsData] = await Promise.all([
          resultsResponse.json(),
          asvsResponse.json()
        ]);

        setData(resultsData.results);
        setTitle(resultsData.title);
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

  const handleAsvClick = async (taxonID, coordinatePair, sequence, scientificName) => {
    try {
      setCongenericsLoading(true);
      setCongenericsError(null);
      
      const hash = CryptoJS.SHA256(sequence).toString();
      const filename = `${taxonID}_${coordinatePair}_${hash}.json`;
      
      setSelectedAsvInfo({
        taxonID,
        coordinatePair,
        sequence,
        hash,
        filename,
        scientificName
      });
      
      const response = await fetch(`/output/${dataset}/congenerics/${filename}`);
      if (!response.ok) {
        throw new Error(`Failed to load congenerics data: ${response.status}`);
      }
      const congenericsData = await response.json();
      const sortedCongenericsData = [...congenericsData].sort((a, b) => {
        let aVal = a["score"];
        let bVal = b["score"];
        if (aVal === null || aVal === undefined) aVal = 0;
        if (bVal === null || bVal === undefined) bVal = 0;
        aVal = parseFloat(aVal) || 0;
        bVal = parseFloat(bVal) || 0;
        return bVal - aVal;
      });
      setCongenericsData(sortedCongenericsData);
      setShowCongenericsModal(true);
    } catch (err) {
      setCongenericsError(err.message);
    } finally {
      setCongenericsLoading(false);
    }
  };

  const closeCongenericsModal = () => {
    setShowCongenericsModal(false);
    setCongenericsData(null);
    setSelectedAsvInfo(null);
    setCongenericsError(null);
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortField) return 0;
    
    let aVal = a[sortField];
    let bVal = b[sortField];
    
    // Handle null/undefined values
    if (aVal === null || aVal === undefined) aVal = 0;
    if (bVal === null || bVal === undefined) bVal = 0;
    
    // Convert to numbers for numeric fields
    if (['density', 'suitability', 'cells', 'score'].includes(sortField)) {
      aVal = parseFloat(aVal) || 0;
      bVal = parseFloat(bVal) || 0;
    }
    
    if (typeof aVal === 'string') {
      return sortDirection === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const filteredData = sortedData.filter(item =>
    // item.scientificName.toLowerCase().includes(searchTerm.toLowerCase())
    item
  );

  const formatNumber = (num) => {
    if (typeof num !== 'number') return num;
    return num.toLocaleString();
  };

  // Generic color scale function for different columns
  const getColorScale = (field, interpolator, scaleType = 'sequential') => {
    if (data.length === 0) return () => '#ffffff';
    
    const values = data.map(item => parseFloat(item[field]) || 0);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    
    if (scaleType === 'diverging') {
      return scaleDiverging(interpolator)
        .domain([minValue, (minValue + maxValue) / 2, maxValue]);
    } else {
      return scaleSequential(interpolator)
        .domain([minValue, maxValue]);
    }
  };

  // Specific color scales for each column
  const getScoreColorScale = () => {
    return getColorScale('score', interpolateSpectral, 'diverging');
  };

  const getDensityColorScale = () => {
    return getColorScale('density', interpolateBlues, 'sequential');
  };

  const getSuitabilityColorScale = () => {
    return getColorScale('suitability', interpolateBlues, 'sequential');
  };

  // Generic badge style function for any column
  const getBadgeStyle = (value, colorScale) => {
    const numValue = parseFloat(value) || 0;
    const color = colorScale(numValue);
    let backgroundColor = 'rgba(200, 200, 200, 0.3)';
    
    try {
      if (color && color.startsWith('#')) {
        const hex = color.replace('#', '');
        if (hex.length === 6) {
          const r = parseInt(hex.substr(0, 2), 16);
          const g = parseInt(hex.substr(2, 2), 16);
          const b = parseInt(hex.substr(4, 2), 16);
          backgroundColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
        }
      } else if (color && color.startsWith('rgb')) {
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (rgbMatch) {
          const r = parseInt(rgbMatch[1]);
          const g = parseInt(rgbMatch[2]);
          const b = parseInt(rgbMatch[3]);
          backgroundColor = `rgba(${r}, ${g}, ${b}, 0.4)`;
        }
      }
    } catch (error) {
      console.error('Color parsing error:', error);
    }
    
    return {
      backgroundColor: backgroundColor,
      color: '#000000',
      padding: '4px 8px',
      borderRadius: '12px',
      fontSize: '0.875rem',
      fontWeight: '500',
      display: 'inline-block',
      minWidth: '40px',
      textAlign: 'center'
    };
  };

  // Specific badge style functions for each column
  const getScoreBadgeStyle = (score) => {
    return getBadgeStyle(score, getScoreColorScale());
  };

  const getDensityBadgeStyle = (density) => {
    return getBadgeStyle(density, getDensityColorScale());
  };

  const getSuitabilityBadgeStyle = (suitability) => {
    return getBadgeStyle(suitability, getSuitabilityColorScale());
  };

  // Congenerics color scales with fixed 0-1 range
  const getCongenericsScoreColorScale = () => {
    return scaleDiverging(interpolateSpectral).domain([0, 0.5, 1]);
  };

  const getCongenericsDensityColorScale = () => {
    return scaleSequential(interpolateBlues).domain([0, 1]);
  };

  const getCongenericsIdentityColorScale = () => {
    return scaleSequential(interpolateBlues).domain([0, 1]);
  };

  const getCongenericsSuitabilityColorScale = () => {
    return scaleSequential(interpolateBlues).domain([0, 1]);
  };

  // Congenerics badge style functions
  const getCongenericsScoreBadgeStyle = (score) => {
    return getBadgeStyle(score, getCongenericsScoreColorScale());
  };

  const getCongenericsDensityBadgeStyle = (density) => {
    return getBadgeStyle(density, getCongenericsDensityColorScale());
  };

  const getCongenericsIdentityBadgeStyle = (identity) => {
    return getBadgeStyle(identity, getCongenericsIdentityColorScale());
  };

  const getCongenericsSuitabilityBadgeStyle = (suitability) => {
    return getBadgeStyle(suitability, getCongenericsSuitabilityColorScale());
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
            <h1 className="mb-4">eDNA QC results: {title}</h1>
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
                    onClick={() => handleSort('phylum')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Phylum {sortField === 'phylum' && (sortDirection === 'asc' ? '↑' : '↓')}
                  </th>
                  <th>
                    Location
                  </th>
                  <th 
                    onClick={() => handleSort('score')} 
                    className="sortable"
                    style={{ cursor: 'pointer' }}
                  >
                    Score {sortField === 'score' && (sortDirection === 'asc' ? '↑' : '↓')}
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
                          className="speciesname"
                          style={{ cursor: 'pointer' }}
                          onClick={() => toggleRowExpansion(item.taxonID)}
                        >
                          {item.scientificName}
                          {/* <span className="ms-2">
                            {isExpanded ? '▼' : '▶'}
                          </span> */}
                        </td>
                        <td className="taxonid">
                          <a 
                            href={`https://obis.org/taxon/${item.taxonID}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none"
                          >
                            {item.taxonID}
                          </a>
                        </td>
                        <td>
                            {item.phylum}
                        </td>
                        <td>
                            <a className="text-decoration-none" target="_blank" href={`https://wktmap.com?wkt=POINT(${item.decimalLongitude} ${item.decimalLatitude})`}>Map</a>
                        </td>
                        <td>
                          <span style={getScoreBadgeStyle(item.score)}>
                            {formatNumber(item.score)}
                          </span>
                        </td>
                        <td>
                          <span style={getDensityBadgeStyle(item.density)}>
                            {formatNumber(item.density)}
                          </span>
                        </td>
                        <td>
                          <span style={getSuitabilityBadgeStyle(item.suitability)}>
                            {formatNumber(item.suitability)}
                          </span>
                        </td>
                        <td>{formatNumber(item.cells)}</td>
                      </tr>
                      {isExpanded && coordinatePairs.length > 0 && (
                        <tr>
                          <td colSpan="7" className="bg-light">
                            <div className="p-3">
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
                                          </div>
                                        </div>
                                        <div className="card-body">
                                          <div className="row">
                                            {sequences.map((sequence, seqIndex) => (
                                              <div key={seqIndex} className="col-md-6 col-lg-4 mb-3">
                                                <div 
                                                  className="border rounded p-2 bg-light clickable-asv"
                                                  style={{ cursor: 'pointer' }}
                                                  onClick={() => handleAsvClick(item.taxonID, coordinatePair, sequence, item.scientificName)}
                                                >
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

      {/* Congenerics Modal */}
      <Modal show={showCongenericsModal} onHide={closeCongenericsModal} size="xl" centered>
        <Modal.Header closeButton>
          <Modal.Title>
            Congenerics analysis: {selectedAsvInfo && <span>{selectedAsvInfo.scientificName}</span>}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {congenericsLoading ? (
            <div className="text-center py-4">
              <Spinner animation="border" role="status">
                <span className="visually-hidden">Loading congenerics...</span>
              </Spinner>
              <div className="mt-2">Loading congenerics data...</div>
            </div>
          ) : congenericsError ? (
            <Alert variant="danger">
              <Alert.Heading>Error Loading Congenerics</Alert.Heading>
              <p>{congenericsError}</p>
            </Alert>
          ) : congenericsData ? (
            <div>
              {selectedAsvInfo && (
                <div className="mb-3">
                  {selectedAsvInfo && (
                    <div className="mb-2">
                      TaxonID: <a 
                          href={`https://obis.org/taxon/${selectedAsvInfo.taxonID}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-decoration-none"
                        >
                          {selectedAsvInfo.taxonID}
                        </a> | Coordinates: <a className="text-decoration-none" target="_blank" href={`https://wktmap.com?wkt=POINT(${selectedAsvInfo.decimalLongitude} ${selectedAsvInfo.decimalLatitude})`}>Map</a>
                    </div>
                  )}
                  <div className="bg-light p-2 rounded">
                    <code className="small" style={{ wordBreak: 'break-all' }}>
                      {selectedAsvInfo.sequence}
                    </code>
                  </div>
                </div>
              )}
              
              {Array.isArray(congenericsData) ? (
                <Table responsive>
                  <thead className="">
                    <tr>
                      <th>Scientific Name</th>
                      <th>Taxon ID</th>
                      <th>pident</th>
                      <th>Score</th>
                      <th>Density</th>
                      <th>Identity</th>
                      <th>Suitability</th>
                      <th>Reference DB</th>
                      <th>Cells</th>
                    </tr>
                  </thead>
                  <tbody>
                    {congenericsData.map((item, index) => (
                      <tr key={index}>
                        <td className={selectedAsvInfo.scientificName == item.scientificName ? 'speciesname selectedspecies' : 'speciesname'}>{item.scientificName || 'N/A'}</td>
                        <td>
                          {item.taxonID ? (
                            <a 
                              href={`https://obis.org/taxon/${item.taxonID}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none"
                            >
                              {item.taxonID}
                            </a>
                          ) : 'N/A'}
                        </td>
                        <td>
                          {item.pident !== null ? item.pident : ''}
                        </td>
                        <td>
                          {item.score !== null ? (
                            <span style={getCongenericsScoreBadgeStyle(item.score)}>
                              {formatNumber(item.score)}
                            </span>
                          ) : ''}
                        </td>
                        <td>
                          {item.density !== null ? (
                            <span style={getCongenericsDensityBadgeStyle(item.density)}>
                              {formatNumber(item.density)}
                            </span>
                          ) : ''}
                        </td>
                        <td>
                          {item.identity !== null ? (
                            <span style={getCongenericsIdentityBadgeStyle(item.identity)}>
                              {formatNumber(item.identity)}
                            </span>
                          ) : ''}
                        </td>
                        <td>
                          {item.suitability !== null ? (
                            <span style={getCongenericsSuitabilityBadgeStyle(item.suitability)}>
                              {formatNumber(item.suitability)}
                            </span>
                          ) : ''}
                        </td>
                        <td>{item.refdb ? 'Yes' : '-'}</td>
                        <td>{item.cells !== null ? formatNumber(item.cells) : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              ) : (
                <div className="bg-light p-3 rounded">
                  <pre className="mb-0" style={{ fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(congenericsData, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : null}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={closeCongenericsModal}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default App;
