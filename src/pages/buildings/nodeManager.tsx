import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getNodesByBuilding, createNode, deleteNode, updateNode, connectNodes, type Node, type CreateNodeRequest } from "../../apis/nodesApi";
import { getMyBuildings } from "../../apis/building";
import SvgUploader from "../../components/svgUploader";
import InteractiveMap from "../../components/interactiveMapImproved";
import SimpleQRCodeDisplay from "../../components/simpleQRCodeDisplay";
import { usePageAnimations } from "../../lib/animations";
import { PageHeader, PageShell } from "../../components/ui/layout";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Alert, EmptyState } from "../../components/ui/feedback";
import { Field, TextField } from "../../components/ui/field";
import { inputStyles } from "../../components/ui/styles";
import {
  BuildingIcon,
  MapIcon,
  MapPinIcon,
  PlusIcon,
  QrCodeIcon,
  RouteIcon,
  TrashIcon,
} from "../../components/ui/icons";

const NodeManager = () => {
  const { buildingId } = useParams<{ buildingId: string }>();
  const navigate = useNavigate();
  const rootRef = usePageAnimations();

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
    <div ref={rootRef}>
      <PageShell width="wide">
        <div data-hero>
          <PageHeader
            title="Emergency Routing Nodes"
            description="Place, connect and manage the escape-route nodes for every floor."
          />
        </div>

        {/* Building Info */}
        {building && (
          <div data-hero className="pt-8">
            <Card className="flex items-center gap-4 p-6">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-subtle text-brand-text">
                <BuildingIcon size={22} />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-ink">{building.buildingName}</h2>
                <p className="text-sm text-ink-muted">Manage emergency routing nodes for this building</p>
              </div>
            </Card>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert tone="danger" className="mt-6">
            {error}
          </Alert>
        )}

        {/* Controls */}
        <div data-hero className="flex flex-wrap items-center gap-3 pt-6">
          <Field label="Floor" hideLabel className="w-full sm:w-56">
            {({ id }) => (
              <select
                id={id}
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(Number(e.target.value))}
                className={inputStyles({ className: "cursor-pointer" })}
              >
                {floorOptions.map((option: { value: number; label: string }) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            )}
          </Field>

          <Button
            onClick={() => {
              setShowCreateForm(!showCreateForm);
            }}
            variant={showCreateForm ? "secondary" : "primary"}
          >
            {!showCreateForm && <PlusIcon size={18} />}
            {showCreateForm ? "Cancel" : "Create Node"}
          </Button>

          {/* Map Upload Button - Always show if no map exists */}
          {(!floorSvgContent && !floorMapUrl) && (
            <Button
              onClick={() => setShowSvgUploader(!showSvgUploader)}
              variant="secondary"
            >
              <MapIcon size={18} />
              {showSvgUploader ? "Cancel Upload" : "Upload Map"}
            </Button>
          )}

          <Button
            onClick={() => {
              setConnectingMode(!connectingMode);
              setSelectedNode(null);
            }}
            variant={connectingMode ? "subtle" : "secondary"}
          >
            <RouteIcon size={18} />
            {connectingMode ? "Connecting Mode ON" : "Connect Nodes"}
          </Button>
        </div>

        {/* SVG Upload Form */}
        {showSvgUploader && (
          <div className="pt-6">
            <SvgUploader
              buildingId={buildingId!}
              floorNumber={selectedFloor}
              onSvgUploaded={handleSvgUploaded}
            />
          </div>
        )}

        {/* Create Node Form */}
        {showCreateForm && (
          <Card className="mt-6 p-6">
            <h3 className="mb-4 text-xl font-semibold text-ink">
              Create New Node
              {(showCreateForm && (floorSvgContent || floorMapUrl)) && (
                <span className="ml-2 text-sm font-normal text-warning-text">
                  — Click on map to set coordinates
                </span>
              )}
            </h3>
            <form onSubmit={handleCreateNode} className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field label="Node Type">
                  {({ id }) => (
                    <select
                      id={id}
                      value={newNode.type}
                      onChange={(e) => setNewNode({...newNode, type: e.target.value as any})}
                      className={inputStyles({ className: "cursor-pointer" })}
                    >
                      <option value="path">Path Point</option>
                      <option value="exit">Emergency Exit</option>
                      <option value="stairs">Stairs/Elevator</option>
                    </select>
                  )}
                </Field>

                <TextField
                  label="Label"
                  type="text"
                  value={newNode.label}
                  onChange={(e) => setNewNode({...newNode, label: e.target.value})}
                  placeholder="e.g., Main Exit, Stairs to Floor 2"
                />

                <TextField
                  label="X Position"
                  type="number"
                  hint={
                    showCreateForm && (floorSvgContent || floorMapUrl)
                      ? "Click the map to update"
                      : undefined
                  }
                  value={newNode.x}
                  onChange={(e) => setNewNode({...newNode, x: Number(e.target.value)})}
                  placeholder="0-1000"
                  min="0"
                  max="1000"
                />

                <TextField
                  label="Y Position"
                  type="number"
                  hint={
                    showCreateForm && (floorSvgContent || floorMapUrl)
                      ? "Click the map to update"
                      : undefined
                  }
                  value={newNode.y}
                  onChange={(e) => setNewNode({...newNode, y: Number(e.target.value)})}
                  placeholder="0-800"
                  min="0"
                  max="800"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button type="submit">
                  <PlusIcon size={18} />
                  Create Node
                </Button>
                <Button
                  type="button"
                  variant="secondary"
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
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Card>
        )}

        {/* Connecting Mode Instructions */}
        {connectingMode && (
          <Alert tone="info" className="mt-6">
            <p>Click on two nodes to connect them with an escape route</p>
            {selectedNode && <p className="mt-1">Selected node: {selectedNode}</p>}
          </Alert>
        )}

        {/* Nodes Display */}
        <div className="grid grid-cols-1 gap-6 pt-6 xl:grid-cols-3" data-reveal>
          {/* Interactive Map - Takes 2 columns on large screens */}
          <div className="xl:col-span-2">
            <Card className="p-4 sm:p-5">
              <h3 className="mb-4 text-lg font-semibold text-ink">Floor Map</h3>
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
                  <EmptyState
                    className="absolute inset-0"
                    icon={<MapIcon size={24} />}
                    title="No floor map uploaded"
                    description="Upload a floor plan to start creating nodes"
                    action={
                      <Button onClick={() => setShowSvgUploader(true)} variant="secondary">
                        <MapIcon size={18} />
                        Upload Floor Map
                      </Button>
                    }
                  />
                )}
              </div>
            </Card>
          </div>

          {/* Nodes List - Takes 1 column on large screens */}
          <div className="xl:col-span-1">
            <Card className="p-6">
              <h3 className="mb-4 text-xl font-semibold text-ink">Nodes on This Floor</h3>
              {filteredNodes.length === 0 ? (
                <EmptyState
                  icon={<MapPinIcon size={24} />}
                  title="No nodes on this floor yet"
                  description="Click the map or use Create Node to place the first one."
                  className="py-10"
                />
              ) : (
                <ul className="flex max-h-96 list-none flex-col gap-3 overflow-y-auto">
                  {filteredNodes.map(node => (
                    <li
                      key={node._id}
                      className={`rounded-xl border p-4 transition-colors ${
                        selectedNode === node._id
                          ? 'border-info-border bg-info-subtle'
                          : 'border-line bg-surface-2'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <h4 className="font-semibold text-ink">
                            {node.label || `${node.type} node`}
                          </h4>
                          <p className="text-sm text-ink-muted">
                            Type: {node.type} | Position: ({node.x}, {node.y})
                          </p>
                          <p className="text-sm text-ink-subtle">
                            Connections: {node.connections.length} nodes
                          </p>
                        </div>
                        <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => generateQRCode(node)}
                            aria-label={`Show QR code for ${node.label || node.type}`}
                          >
                            <QrCodeIcon size={16} />
                            QR
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => handleDeleteNode(node._id)}
                          >
                            <TrashIcon size={16} />
                            Delete
                          </Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>

        {/* Legend */}
        <div className="pt-6" data-reveal>
          <Card className="p-5">
            <h3 className="mb-3 text-lg font-semibold text-ink">Node Types</h3>
            <ul className="flex list-none flex-wrap gap-x-6 gap-y-2 text-sm text-ink-muted">
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-3 rounded-full bg-success" />
                <span>Emergency Exit</span>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-3 rounded-full bg-info" />
                <span>Stairs/Elevator</span>
              </li>
              <li className="flex items-center gap-2">
                <span aria-hidden="true" className="h-3 w-3 rounded-full bg-warning" />
                <span>Path Point</span>
              </li>
            </ul>
          </Card>
        </div>
      </PageShell>

      {/* QR Code Modal */}
      {selectedQRNode && (
        <SimpleQRCodeDisplay
          node={selectedQRNode}
          buildingName={building?.buildingName}
          // Resolved through floorOptions, the same index-based mapping the
          // floor selector and the map effect use. Matching on the floor name
          // instead meant named floors ("Ground Floor") yielded NaN from
          // parseInt and the modal showed the wrong floor, or none.
          floorName={floorOptions.find(
            (option: { value: number; floorName?: string }) => option.value === selectedFloor,
          )?.floorName}
          onClose={() => setSelectedQRNode(null)}
        />
      )}
    </div>
  );
};

export default NodeManager;
