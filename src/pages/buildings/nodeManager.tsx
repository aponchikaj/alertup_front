import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PageHeader from "../../components/pageHeader";
import { getNodesByBuilding, createNode, deleteNode, updateNode, connectNodes, type Node, type CreateNodeRequest } from "../../apis/nodesApi";
import { getMyBuildings } from "../../apis/building";
import SvgUploader from "../../components/svgUploader";
import InteractiveMap from "../../components/interactiveMapImproved";
import SimpleQRCodeDisplay from "../../components/simpleQRCodeDisplay";

const NodeManager = () => {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();

  const [building, setBuilding] = useState<any>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [error, setError] = useState("");
  const [selectedFloor, setSelectedFloor] = useState(1);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [connectingMode, setConnectingMode] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [floorSvgContent, setFloorSvgContent] = useState<string | null>(null);
  const [floorMapUrl, setFloorMapUrl] = useState<string | null>(null);
  const [showSvgUploader, setShowSvgUploader] = useState(false);
  const [selectedQRNode, setSelectedQRNode] = useState<Node | null>(null);

  // Form state for creating nodes
  const [newNode, setNewNode] = useState<CreateNodeRequest>({
    buildingId: buildingId || "",
    floorNumber: 1,
    x: 0,
    y: 0,
    type: "path",
    label: ""
  });

  useEffect(() => {
    if (!buildingId) {
      navigate("/mybuildings");
      return;
    }

    // eslint-disable-next-line react-hooks/immutability
    loadBuildingAndNodes();
  }, [buildingId]);

  useEffect(() => {
    if (buildingId && selectedFloor && building) {
      // Get the selected floor option to get the actual floor name
      const selectedFloorOption = floorOptions.find((option:any) => option.value === selectedFloor);
      const actualFloorName = selectedFloorOption?.floorName;
      
      const floorMap = building.maps?.find((map: any) => {
        const stringMatch = map.floor === actualFloorName;
        const numberMatch = parseInt(map.floor) === selectedFloor;
        return stringMatch || numberMatch;
      });
      
      const loadMap = async () => {
        if (floorMap && floorMap.map) {
          // Check if it's a Cloudinary URL (starts with http)
          if (floorMap.map.startsWith('http')) {
            setFloorMapUrl(floorMap.map);
            setFloorSvgContent(null);
          } else if (floorMap.map.includes('<svg')) {
            // It's SVG content
            setFloorSvgContent(floorMap.map);
            setFloorMapUrl(null);
          } else {
            // Try to fetch as SVG content
            try {
              const response = await fetch(floorMap.map);
              const svgContent = await response.text();
              if (svgContent.includes('<svg')) {
                setFloorSvgContent(svgContent);
                setFloorMapUrl(null);
              } else {
                setFloorMapUrl(floorMap.map);
                setFloorSvgContent(null);
              }
            } catch (err) {
              console.error('Failed to fetch map:', err);
              setFloorMapUrl(null);
              setFloorSvgContent(null);
            }
          }
          setError("");
        } else {
          setFloorSvgContent(null);
          setFloorMapUrl(null);
        }
      };

      loadMap();
    }
  }, [buildingId, selectedFloor, building]);

  const loadBuildingAndNodes = async () => {
    try {
      // Load building info
      const buildingsRes = await getMyBuildings();
      const buildingData = buildingsRes.Message?.find((b: any) => b._id === buildingId);
      setBuilding(buildingData);

      // Load nodes
      const nodesRes = await getNodesByBuilding(buildingId!);
      setNodes(nodesRes.nodes || []);

      // Don't reset floor map state here - let the useEffect handle it
      // This was causing the image to disappear
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    }
  };

  const handleCreateNode = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const nodeData = { ...newNode, buildingId: buildingId!, floorNumber: selectedFloor };
      
      const result = await createNode(nodeData);
      console.log(result)
      
      if (result.success) {
        setNodes([...nodes, result.node]);
        setShowCreateForm(false);
        setNewNode({
          buildingId: buildingId!,
          floorNumber: selectedFloor,
          x: 0,
          y: 0,
          type: "path",
          label: ""
        });
      } else {
        setError(result.message || "Failed to create node");
      }
    } catch (err: any) {
      console.error('❌ Error creating node:', err);
      setError(err.message || "Failed to create node");
    }
  };

  // Handle node creation from map click
  const handleCreateNodeFromMap = (x: number, y: number) => {
    setNewNode(prev => ({
      ...prev,
      x,
      y
    }));
    setShowCreateForm(true);
  };

  const handleDeleteNode = async (nodeId: string) => {
    if (!confirm("Are you sure you want to delete this node?")) return;
    
    try {
      const result = await deleteNode(nodeId);
      if (result.success) {
        setNodes(nodes.filter(n => n._id !== nodeId));
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete node");
    }
  };

  const handleNodeUpdate = async (nodeId: string, x: number, y: number) => {
    try {
      const result = await updateNode(nodeId, { x, y });
      if (result.success) {
        // Update the node in the local state
        setNodes(nodes.map(node => 
          node._id === nodeId 
            ? { ...node, x, y, updatedAt: new Date().toISOString() }
            : node
        ));
      } else {
        setError(result.message || "Failed to update node position");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update node position");
    }
  };

  const handleNodeClick = (nodeId: string) => {
    if (connectingMode) {
      if (selectedNode && selectedNode !== nodeId) {
        // Connect the two nodes
        connectNodes(buildingId!, selectedNode, nodeId)
          .then(result => {
            if (result.success) {
              loadBuildingAndNodes(); // Reload to show connections
              setConnectingMode(false);
              setSelectedNode(null);
            }
          })
          .catch(err => setError(err.message));
      } else {
        setSelectedNode(nodeId);
      }
    }
  };

  const generateQRCode = (node: Node) => {
    setSelectedQRNode(node);
  };

  const handleSvgUploaded = (svgData: { svgContent: string; width: number; height: number }) => {
    setFloorSvgContent(svgData.svgContent);
    setShowSvgUploader(false);
    setError("");
  };

  const filteredNodes = nodes.filter(n => n.floorNumber === selectedFloor);
  const floorOptions = building?.maps?.map((map: any, index: number) => ({
    value: index + 1, // Use index for value
    label: map.floor || `Floor ${index + 1}`, // Use actual floor name from map
    floorName: map.floor // Store the actual floor name
  })) || [{ value: 1, label: 'Floor 1', floorName: '1' }];

  return (
    <main className="min-h-screen bg-[#353535] text-white px-4 py-16">
      < div className="w-full h-[5vh]"/>
      <PageHeader title="Emergency Routing Nodes" />
      
      <div className="max-w-7xl mx-auto">
        {/* Building Info */}
        {building && (
          <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
            <h2 className="text-2xl font-bold text-[#FF7B22] mb-2">{building.buildingName}</h2>
            <p className="text-gray-300">Manage emergency routing nodes for this building</p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500 rounded-lg text-red-300">
            {error}
          </div>
        )}

        {/* Controls */}
        <div className="mb-6 flex flex-wrap gap-4">
          <select
            value={selectedFloor}
            onChange={(e) => setSelectedFloor(Number(e.target.value))}
            className="px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
          >
            {floorOptions.map((option: { value: number; label: string }) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
            }}
            className="px-4 py-2 bg-[#FF7B22] text-white rounded-lg hover:bg-[#FF7B22]/80"
          >
            {showCreateForm ? "Cancel" : "Create Node"}
          </button>

          {/* Map Upload Button - Always show if no map exists */}
          {(!floorSvgContent && !floorMapUrl) && (
            <button
              onClick={() => setShowSvgUploader(!showSvgUploader)}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-500/80"
            >
              {showSvgUploader ? "Cancel Upload" : "Upload Map"}
            </button>
          )}

          <button
            onClick={() => {
              setConnectingMode(!connectingMode);
              setSelectedNode(null);
            }}
            className={`px-4 py-2 rounded-lg ${
              connectingMode 
                ? "bg-green-500 text-white" 
                : "bg-blue-500 text-white hover:bg-blue-500/80"
            }`}
          >
            {connectingMode ? "Connecting Mode ON" : "Connect Nodes"}
          </button>
        </div>

        {/* SVG Upload Form */}
        {showSvgUploader && (
          <SvgUploader
            buildingId={buildingId!}
            floorNumber={selectedFloor}
            onSvgUploaded={handleSvgUploaded}
          />
        )}

        {/* Create Node Form */}
        {showCreateForm && (
          <div className="mb-8 p-6 bg-white/5 rounded-lg border border-white/10">
            <h3 className="text-xl font-bold mb-4">
              Create New Node {(showCreateForm && (floorSvgContent || floorMapUrl)) && (
                <span className="text-sm text-yellow-400 ml-2">
                  - Click on map to set coordinates
                </span>
              )}
            </h3>
            <form onSubmit={handleCreateNode} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Node Type</label>
                  <select
                    value={newNode.type}
                    onChange={(e) => setNewNode({...newNode, type: e.target.value as any})}
                    className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                  >
                    <option value="path">Path Point</option>
                    <option value="exit">Emergency Exit</option>
                    <option value="stairs">Stairs/Elevator</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Label</label>
                  <input
                    type="text"
                    value={newNode.label}
                    onChange={(e) => setNewNode({...newNode, label: e.target.value})}
                    placeholder="e.g., Main Exit, Stairs to Floor 2"
                    className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    X Position 
                    {showCreateForm && (floorSvgContent || floorMapUrl) && (
                      <span className="text-xs text-yellow-400 ml-2">
                        (Click map to update)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={newNode.x}
                    onChange={(e) => setNewNode({...newNode, x: Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                    placeholder="0-1000"
                    min="0"
                    max="1000"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    Y Position
                    {showCreateForm && (floorSvgContent || floorMapUrl) && (
                      <span className="text-xs text-yellow-400 ml-2">
                        (Click map to update)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    value={newNode.y}
                    onChange={(e) => setNewNode({...newNode, y: Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-black/40 border border-white/20 rounded-lg text-white"
                    placeholder="0-800"
                    min="0"
                    max="800"
                  />
                </div>
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#FF7B22] text-white rounded-lg hover:bg-[#FF7B22]/80"
                >
                  Create Node
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setNewNode({
                      buildingId: buildingId!,
                      floorNumber: selectedFloor,
                      x: 0,
                      y: 0,
                      type: "path",
                      label: ""
                    });
                  }}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-500/80"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Connecting Mode Instructions */}
        {connectingMode && (
          <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500 rounded-lg text-blue-300">
            <p>🔗 Click on two nodes to connect them with an escape route</p>
            {selectedNode && <p>Selected node: {selectedNode}</p>}
          </div>
        )}

        {/* Nodes Display */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Interactive Map - Takes 2 columns on large screens */}
          <div className="xl:col-span-2">
            <div className="bg-white/5 rounded-lg border border-white/10 p-4">
              <h3 className="text-lg font-bold mb-4 text-white">Floor Map</h3>
              <div className="relative" style={{ height: '600px', width: '100%' }}>
                {(floorSvgContent || floorMapUrl) ? (
                  <InteractiveMap
                    svgContent={floorSvgContent}
                    floorMapUrl={floorMapUrl}
                    nodes={filteredNodes}
                    selectedFloor={selectedFloor}
                    onNodeClick={handleNodeClick}
                    selectedNode={selectedNode}
                    hoveredNode={hoveredNode}
                    onNodeHover={setHoveredNode}
                    onNodeUpdate={handleNodeUpdate}
                    onCreateNode={handleCreateNodeFromMap}
                    createMode={showCreateForm}
                    width={800}
                    height={600}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded-lg border-2 border-dashed border-gray-600">
                    <div className="text-center p-8">
                      <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586 1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-400 font-medium mb-2">No floor map uploaded</p>
                      <p className="text-sm text-gray-500 mb-4">Upload a floor plan to start creating nodes</p>
                      <button
                        onClick={() => setShowSvgUploader(true)}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-500/80"
                      >
                        Upload Floor Map
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Nodes List - Takes 1 column on large screens */}
          <div className="xl:col-span-1">
            <div className="p-6 bg-white/5 rounded-lg border border-white/10">
              <h3 className="text-xl font-bold mb-4">Nodes on This Floor</h3>
              {filteredNodes.length === 0 ? (
                <p className="text-gray-400">No nodes on this floor yet</p>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {filteredNodes.map(node => (
                    <div
                      key={node._id}
                      className={`p-4 rounded-lg border ${
                        selectedNode === node._id 
                          ? 'bg-blue-500/20 border-blue-500' 
                          : 'bg-black/40 border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-semibold">
                            {node.label || `${node.type} node`}
                          </h4>
                          <p className="text-sm text-gray-300">
                            Type: {node.type} | Position: ({node.x}, {node.y})
                          </p>
                          <p className="text-sm text-gray-400">
                            Connections: {node.connections.length} nodes
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => generateQRCode(node)}
                            className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-500/80"
                          >
                            📱 QR
                          </button>
                          <button
                            onClick={() => handleDeleteNode(node._id)}
                            className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-500/80"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-8 p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-lg font-bold mb-2">Node Types</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Emergency Exit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span>Stairs/Elevator</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span>Path Point</span>
            </div>
          </div>
        </div>
      </div>

      {/* QR Code Modal */}
      {selectedQRNode && (
        <SimpleQRCodeDisplay
          node={selectedQRNode}
          buildingName={building?.buildingName}
          floorName={building?.maps?.find((map: any) => 
            map.floor === selectedFloor.toString() || 
            parseInt(map.floor) === selectedFloor
          )?.floor}
          onClose={() => setSelectedQRNode(null)}
        />
      )}
    </main>
  );
};

export default NodeManager;
