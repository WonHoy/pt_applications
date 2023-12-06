"""
Test for one dimensional joint analyzer  backend part
"""
from joint_analysis.analysis.jointdata import *
from joint_analysis.analysis.fem import *
from joint_analysis.analysis.stiffness import *
from joint_analysis.analysis.bdfexport import *

# from stiffness import *
# from jointdata import *

import numpy as np
from operator import attrgetter, itemgetter

PATH_DEBUG_FILE = '.\\joint_analysis\\analysis\\debug_files\\'

# TODO: !MAJOR! current logic works with constraints == 0 only.
# TODO: !MAJOR! current logic works with fastener going through all plates at each node. (see stiffness module also)
# ^^^^ Probably: add 'fastened_plates' = [1, 3, 4] to nodes
# ^^^^ Probably: (a-d) flexibility for (a-c-d) is just (a-c)(c-d)
# TODO: check all the commented lines and clean them up if necessary
# TODO: add doc strings to each method
# TODO: think about how to deal with DB. For now the DB dicts are created as global variables.


class Joint:
    """
    Class containing 1D-JOINT model with all the properties
    """

    def __init__(self, joint_info: dict, materials_db: dict, fasteners_db: dict):
        """
        Class initializer requiring the following inputs in order to create correct model:

        !important!
        Term 'node' within this class means horizontal coordinate reference and not the actual node that is described
        as vertical/horizontal intersection.
        Term 'plate' relates to 'plate_id' only. It does not relate to vertical coordinate.

        :param joint_info: dict containing information regarding nodes, plates, boundary conditions and loads.
        :param materials_db: dict containing information regarding material properties.
        :param fasteners_db: dict containing information regarding fastener properties.
        """

        joint_data = JointInputData(joint_info)
        self.nodes = joint_data.nodes
        self.plates = joint_data.plates
        self.nodes_ids = joint_data.nodes_ids
        self.nodes_qty = joint_data.nodes_qty
        self.plates_ids = joint_data.plates_ids
        self.plates_qty = joint_data.plates_qty
        self.boundary_conditions = joint_data.boundary_conditions
        self.loads = joint_data.loads
        self.grid_points = []
        self.grid_points_ids = []
        self.grid_points_without_constraints = []
        self.constrained_grid_points = []
        self.stiffness_matrix_v2 = []
        # self.materials_db = materials_db
        # self.fasteners_db = fasteners_db
        self.method = joint_data.method
        self.fastener_models = {}
        if self.method != BOEING3PLUS_METHOD:
            for node in self.nodes:
                if node.fastener_id != '':
                    connected_plates = node.plate_ids  # For now it's assumed that all plates in the stack are connected by fastener
                    fastener_model = FastenerModel(node, connected_plates, self.method)
                    # fastener_model = FastenerModel(node, connected_plates, materials_db, fasteners_db, DOUGLAS_METHOD)
                    # fastener_model = FastenerModel(node, connected_plates, materials_db, fasteners_db, AIRBUS_METHOD)
                else:
                    fastener_model = None
                self.fastener_models[node.id] = fastener_model

            # self.fastener_elements = {}
            self.plate_elements = {}

            self.reactions = []

            print('plates_ids', self.plates_ids)
            print('nodes_ids', self.nodes_ids)

            # Calculated attributes. Obtained by class methods.
            self.stiffness_matrix = self.define_stiffness_matrix()
            self.load_vector = self.define_load_vector()
            (disp_react_vector, displacements_dict, reactions_dict) = self.define_displacement_vector()
            self.displacement_vector = disp_react_vector
            self.displacements_dict = displacements_dict
            self.reactions_dict = reactions_dict

            # Saving files for debug

            try:
                save_csv(PATH_DEBUG_FILE + 'stiffness_matrix.csv', self.stiffness_matrix)

                f = open(PATH_DEBUG_FILE + 'displacement_vector.txt', 'w')
                f.write(str(self.displacement_vector))
                f.close()
                matrix_print(self.displacement_vector, 'displacement vector')

                f = open(PATH_DEBUG_FILE + 'load_vector.txt', 'w')
                f.write(str(self.load_vector))
                f.close()
            except FileNotFoundError:
                pass

            self.reactions = self.get_reactions()
            print('reactions: ', self.reactions)
            self.set_elements_displacements()

            # plate_elm_ids = sorted(list(self.plate_elements), key=itemgetter(0,1))
            # print(plate_elm_ids)
            # for elm_id in plate_elm_ids:
            #     elm = self.plate_elements[elm_id]
            #     print(elm)
            #
            # fastener_elm_ids = sorted(list(self.fastener_elements), key=itemgetter(0,1))
            # print(fastener_elm_ids)
            # for elm_id in fastener_elm_ids:
            #     elm = self.fastener_elements[elm_id]
            #     print(elm)
            self.connections = ConnectedElements(self.fastener_models, self.plate_elements, self.nodes_ids, self.plates_ids)
            # summary = self.connections.get_loads_summary()
            loads_and_stresses = self.connections.get_summary_dicts()
            print('**************************get_loads_summary()******************************')
            print(f'results len = {len(loads_and_stresses)}')
            print('loads and stresses:')
            for item in loads_and_stresses:
                print('\n', item)

            self.save_to_bdf()

            self.fasteners_loads_traffics ={}
            for fm_id in list(self.fastener_models):
                fastener_model = self.fastener_models[fm_id]
                if fastener_model is not None:
                    print(fm_id, fastener_model.get_all_loads_traffics_dict())
                    self.fasteners_loads_traffics[fm_id] = fastener_model.get_all_loads_traffics_dict()
        else:
            self.plate_elements_v2 = []
            self.bearing_elements_v2 = []
            self.fastener_elements_v2 = []
            self.v2_define_plate_elements()
            self.v2_define_bearing_elements()
            self.v2_define_fastener_elements()
            self.v2_define_stiffness_matrix()
            self.load_vector_v2 = self.define_load_vector_v2()
            print('load_vector_v2')
            print(self.load_vector_v2)
            self.define_displacement_vector_v2()
            self.displacement_vector_v2 = [gp.displacement for gp in self.grid_points if gp.id < 1000000]
            for gp in self.grid_points:
                print(gp)
            for plate_elm in self.plate_elements_v2:
                plate_elm.calculate_loads()
                print(plate_elm)

            for elm in self.bearing_elements_v2:
                elm.calculate_loads()
                print(elm)

            for elm in self.fastener_elements_v2:
                elm.calculate_loads()
                print(elm)

    def v2_define_plate_elements(self):
        for plate in self.plates:
            plate_id = plate.id
            plate_E = plate.E
            first_node = plate.first_node
            last_node = plate.last_node
            for node_id in range(first_node, last_node):
                node = self.get_node_by_id(node_id)
                next_node = self.get_node_by_id(node_id + 1)
                area1 = node.plate(plate_id).area
                area2 = next_node.plate(plate_id).area
                t1 = node.plate(plate_id).thickness
                t2 = next_node.plate(plate_id).thickness
                coord1_x = node.coord_x
                coord2_x = next_node.coord_x
                coord_y = node.plate(plate_id).coord_y
                grid_point1_id = int(coord_y) + node_id
                grid_point2_id = int(coord_y) + next_node.id
                if not grid_point1_id in self.grid_points_ids:
                    grid_point1 = GridPoint(grid_point1_id, node_id, plate_id, coord1_x, coord_y)
                    self.grid_points.append(grid_point1)
                    self.grid_points_ids.append(grid_point1_id)
                else:
                    gp_index = self.grid_points_ids.index(grid_point1_id)
                    grid_point1 = self.grid_points[gp_index]

                if not grid_point2_id in self.grid_points_ids:
                    grid_point2 = GridPoint(grid_point2_id, next_node.id, plate_id, coord2_x, coord_y)
                    self.grid_points.append(grid_point2)
                    self.grid_points_ids.append(grid_point2_id)
                else:
                    gp_index = self.grid_points_ids.index(grid_point2_id)
                    grid_point2 = self.grid_points[gp_index]

                plate_elm_v2 = PlateElementV2(grid_point1, grid_point2, plate_E, area1, area2, t1, t2)
                self.plate_elements_v2.append(plate_elm_v2)

        print('plate elements v2')
        for elm in self.plate_elements_v2:
            print(elm)

    def v2_define_bearing_elements(self):
        for plate in self.plates:
            for node in self.nodes:
                if node.fastener_id != '':
                    if plate.id in node.plate_ids:
                        coord_y = node.plate(plate.id).coord_y
                        grid_point1_id = int(coord_y) + node.id
                        grid_point2_id = int(coord_y) + node.id + 1000000
                        gp_index = self.grid_points_ids.index(grid_point1_id)
                        grid_point1 = self.grid_points[gp_index]
                        grid_point2 = GridPoint(grid_point2_id, node.id, plate.id, node.coord_x, coord_y)
                        plate_E = plate.E
                        fastener_E = node.fastener_Ebb
                        plate_thickness = node.plate(plate.id).thickness
                        fasteners_qty = node.fasteners_qty
                        self.grid_points.append(grid_point2)
                        print('added', grid_point2)
                        bearing_elm_v2 = BearingElementV2(grid_point1, grid_point2, plate_E, fastener_E,
                                                          plate_thickness, fasteners_qty)
                        self.bearing_elements_v2.append(bearing_elm_v2)

        print('bearing elements v2', len(self.bearing_elements_v2))
        for elm in self.bearing_elements_v2:
            print(elm)

    def v2_define_fastener_elements(self):
        for node in self.nodes:
            if node.fastener_id != '':
                for i in range(len(node.plate_ids) - 1):
                    plate1_id = node.plate_ids[i]
                    plate2_id = node.plate_ids[i + 1]
                    coord1_y = node.plate(plate1_id).coord_y
                    coord2_y = node.plate(plate2_id).coord_y
                    grid_point1_id = int(coord1_y) + node.id + 1000000
                    grid_point2_id = int(coord2_y) + node.id + 1000000
                    diameter = node.get_diameter()
                    fasteners_qty = node.fasteners_qty
                    fastener_E = node.fastener_Ebb
                    fastener_G = node.fastener_Gb
                    thickness1 = node.plate(plate1_id).thickness
                    thickness2 = node.plate(plate2_id).thickness
                    gp1 = [gp for gp in self.grid_points if gp.id == grid_point1_id]
                    print('gp1', len(gp1))
                    [grid_point1] = gp1
                    [grid_point2] = [gp for gp in self.grid_points if gp.id == grid_point2_id]
                    fastener_elm_v2 = FastenerElementV2(grid_point1, grid_point2, fastener_E, fastener_G,
                                                        thickness1, thickness2, diameter, fasteners_qty)
                    self.fastener_elements_v2.append(fastener_elm_v2)

        print('fastener elements v2', len(self.fastener_elements_v2))
        for elm in self.fastener_elements_v2:
            print(elm)

    def v2_define_stiffness_matrix(self):
        n_bc = len(self.boundary_conditions.constraints)
        n_gp = len(self.grid_points)

        n = n_gp - n_bc
        grid_points = []
        for gp in self.grid_points:
            if not self.boundary_conditions.check_constrained(gp.node_id, gp.plate_id):
                grid_points.append(gp)
                print(gp)
            else:
                gp.displacement = 0
                self.constrained_grid_points.append(gp)
        self.grid_points_without_constraints = grid_points
        matrix = np.zeros((n, n))


        for elm in self.plate_elements_v2:

            grid_point1 = elm.grid_point1
            if grid_point1 in grid_points:
                gp1_index = grid_points.index(grid_point1)
            else:
                gp1_index = -1

            grid_point2 = elm.grid_point2
            if grid_point2 in grid_points:
                gp2_index = grid_points.index(grid_point2)
            else:
                gp2_index = -1

            stiffness = elm.stiffness

            if gp1_index != -1:
                matrix[gp1_index][gp1_index] += stiffness

            if gp2_index != -1:
                matrix[gp2_index][gp2_index] += stiffness

            if gp1_index != -1 and gp2_index != -1:
                matrix[gp1_index][gp2_index] += -stiffness
                matrix[gp2_index][gp1_index] += -stiffness

        for elm in self.bearing_elements_v2:

            grid_point1 = elm.grid_point1
            if grid_point1 in grid_points:
                gp1_index = grid_points.index(grid_point1)
            else:
                gp1_index = -1

            grid_point2 = elm.grid_point2
            if grid_point2 in grid_points:
                gp2_index = grid_points.index(grid_point2)
            else:
                gp2_index = -1

            stiffness = elm.stiffness

            if gp1_index != -1:
                matrix[gp1_index][gp1_index] += stiffness

            if gp2_index != -1:
                matrix[gp2_index][gp2_index] += stiffness

            if gp1_index != -1 and gp2_index != -1:
                matrix[gp1_index][gp2_index] += -stiffness
                matrix[gp2_index][gp1_index] += -stiffness

        for elm in self.fastener_elements_v2:

            grid_point1 = elm.grid_point1
            if grid_point1 in grid_points:
                gp1_index = grid_points.index(grid_point1)
            else:
                gp1_index = -1

            grid_point2 = elm.grid_point2
            if grid_point2 in grid_points:
                gp2_index = grid_points.index(grid_point2)
            else:
                gp2_index = -1

            stiffness = elm.stiffness

            if gp1_index != -1:
                matrix[gp1_index][gp1_index] += stiffness

            if gp2_index != -1:
                matrix[gp2_index][gp2_index] += stiffness

            if gp1_index != -1 and gp2_index != -1:
                matrix[gp1_index][gp2_index] += -stiffness
                matrix[gp2_index][gp1_index] += -stiffness

        try:
            save_csv(PATH_DEBUG_FILE + 'stiffness_matrix_v2.csv', matrix)
        except FileNotFoundError:
            pass

        self.stiffness_matrix_v2 = matrix

    def summary_at_gridpoints_v2(self):
        summary = []
        for elm in self.bearing_elements_v2:
            summary_at_gridpoint = {}
            grid_point = elm.grid_point1
            node_id = grid_point.node_id
            plate_id = grid_point.plate_id
            node = self.get_node_by_id(node_id)
            diameter = node.get_diameter()
            thickness = elm.plate_thickness
            (grid_point1_id, grid_point2_id) = elm.id
            connected_plate_elms = []
            for plate_elm in self.plate_elements_v2:
                if grid_point1_id in plate_elm.id:
                    connected_plate_elms.append(plate_elm)
            # load_transfer = elm.end_load
            if len(connected_plate_elms) == 2:
                p_elm1 = connected_plate_elms[0]
                p_elm2 = connected_plate_elms[1]
                if abs(p_elm1.end_load) > abs(p_elm2.end_load):
                    applied_load = p_elm1.end_load
                    ft_app = p_elm1.get_stress_at_grid_point_id(grid_point1_id)
                    bypass_load = p_elm2.end_load
                    ft_by =  p_elm2.get_stress_at_grid_point_id(grid_point1_id)
                else:
                    applied_load = p_elm2.end_load
                    ft_app = p_elm2.get_stress_at_grid_point_id(grid_point1_id)
                    bypass_load = p_elm1.end_load
                    ft_by = p_elm1.get_stress_at_grid_point_id(grid_point1_id)
            else:
                p_elm = connected_plate_elms[0]
                applied_load = p_elm.end_load
                ft_app = p_elm.get_stress_at_grid_point_id(grid_point1_id)
                bypass_load = 0.0
                ft_by = 0.0

            load_transfer = applied_load - bypass_load
            fbr = load_transfer / (diameter * thickness)

            fbr_ftapp = fbr / ft_app
            ftby_ftapp = ft_by / ft_app
            jarfall_effective_stress = 0.569 * abs(fbr) + abs(ft_by)

            summary_at_gridpoint['node_id'] = node_id
            summary_at_gridpoint['plate_id'] = plate_id
            summary_at_gridpoint['coord_x'] = grid_point.coord_x
            summary_at_gridpoint['coord_y'] = grid_point.coord_y
            summary_at_gridpoint['load_transfer'] = load_transfer
            summary_at_gridpoint['bypass_load'] = bypass_load
            summary_at_gridpoint['applied_load'] = applied_load
            summary_at_gridpoint['bearing_stress'] = fbr
            summary_at_gridpoint['bypass_stress'] = ft_by
            summary_at_gridpoint['applied_stress'] = ft_app
            summary_at_gridpoint['bearing_over_applied_stresss'] = fbr_ftapp
            summary_at_gridpoint['bypass_over_applied_stress'] = ftby_ftapp
            summary_at_gridpoint['jarfall_effective_stress'] = jarfall_effective_stress
            summary.append(summary_at_gridpoint)
        return summary

    def get_node_by_id(self, node_id):
        node_index = self.nodes_ids.index(node_id)
        node = self.nodes[node_index]
        return node

    def define_displacement_vector(self) -> np.ndarray:
        """
        Method calculates displacement vector basing on stiffness matrix and load vector.

        :return: displacement vector
        """
        disp_react_vector = np.linalg.inv(self.stiffness_matrix).dot(self.load_vector)
        displacements_dict = {}
        reactions_dict = {}
        for plate_index in range(self.plates_qty):
            for node_index in range(self.nodes_qty):
                disp_index = plate_index * self.nodes_qty + node_index
                node_id = self.nodes_ids[node_index]
                plate_id = self.plates_ids[plate_index]
                if self.boundary_conditions.check_constrained(node_id, plate_id):
                    reaction =  disp_react_vector[disp_index]
                    reactions_dict[(node_id, plate_id)] = reaction
                    displacements_dict[(node_id, plate_id)] = 0.0
                else:
                    displacement = disp_react_vector[disp_index]
                    displacements_dict[(node_id, plate_id)] = displacement

        return (disp_react_vector, displacements_dict, reactions_dict)

    def define_displacement_vector_v2(self):
        displacement_vector = np.linalg.inv(self.stiffness_matrix_v2).dot(self.load_vector_v2)
        for i, grid_point in enumerate(self.grid_points_without_constraints):
            grid_point.displacement = displacement_vector[i]


    def define_load_vector(self) -> list:
        """
        Method creates load vector basing on input load data.

        :return: load vector.
        """
        load_vector = [0 for _ in range(self.plates_qty * self.nodes_qty)]
        for load in self.loads:
            node_index = self.nodes_ids.index(load.node_id)
            plate_index = self.plates_ids.index(load.plate_id)
            index = self.nodes_qty * plate_index + node_index
            load_vector[index] = -load.load_value
        return load_vector

    def define_load_vector_v2(self) -> list:
        n = len(self.grid_points_without_constraints)
        grid_points_ids = [gp.id for gp in self.grid_points_without_constraints]
        load_vector = [0 for _ in range(n)]
        for load in self.loads:
            node_id = load.node_id
            node = self.get_node_by_id(node_id)
            coord_y = node.plate(load.plate_id).coord_y
            grid_point_id = int(coord_y) + node.id
            gp_index = grid_points_ids.index(grid_point_id)
            load_vector[gp_index] = load.load_value
        return load_vector
    def define_stiffness_matrix(self) -> np.ndarray:
        """
        Method defines model stiffness matrix.
        1) It creates blocks of matrices <nodes_qty * nodes_qty>
        2) Quantity of block equals <plates_qty ** 2>
        3) Blocks on main diagonal -> matrices with fastener+plates combined stiffness
        4) Other blocks -> matrices with interplate stiffness
        5) Boundary conditions are already taken into account and, therefore, matrix can be unsymmetrical

        :return: model stiffness matrix
        """
        stiffness_matrix_blocks = [
            [np.zeros((self.nodes_qty, self.nodes_qty)) for _ in range(self.plates_qty)] for _ in range(self.plates_qty)
        ]
        for i in range(self.plates_qty):
            for j in range(self.plates_qty):
                if i == j:
                    plate_id = self.plates_ids[i]
                    stiffness_matrix_blocks[i][j] = self.define_plate_and_fastener_combined_stiffness_matrix(plate_id)
                elif i < j:
                    plate1_id = self.plates_ids[i]
                    plate2_id = self.plates_ids[j]
                    stiffness_matrix_blocks[i][j] = self.define_interplate_fastener_stiffness_matrix(plate1_id, plate2_id)
                else:
                    stiffness_matrix_blocks[i][j] = stiffness_matrix_blocks[j][i]
        stiffness_matrix = np.vstack([np.hstack(block_row) for block_row in stiffness_matrix_blocks])
        matrix_print(stiffness_matrix, 'stiffness_matrix')
        return stiffness_matrix

    # def define_interplate_fastener_flexibility(self, node: Node, plate1_id: int, plate2_id: int) -> float:
    #     d = self.fasteners_db[node.fastener_id]['D']
    #     Ef = self.fasteners_db[node.fastener_id]['Ebb']
    #     t1 = node.plate(plate1_id).thickness
    #     t2 = node.plate(plate2_id).thickness
    #     E1 = self.materials_db[node.plate(plate1_id).material_id]['E']
    #     E2 = self.materials_db[node.plate(plate2_id).material_id]['E']
    #     flexibility = Stiffness.swift_douglas_flexibility(d, Ef, t1, E1, t2, E2)
    #     return flexibility

    def define_interplate_fastener_stiffness_matrix(self, plate1_id: int, plate2_id: int) -> np.ndarray:
        fastener_stiffness_array = []
        print('******START******: define_interplate_fastener_stiffness_matrix')
        print('plates: ', plate1_id, plate2_id)
        for node in self.nodes:
            if not node.check_fastend(plate1_id, plate2_id):
                fastener_stiffness_array.append(0)
            else:
                # flexibilities = []
                # plates_pairs = node.adjacent_plates_pairs_between(plate1_id, plate2_id)
                # for item in plates_pairs:
                #     flexibilities.append(self.define_interplate_fastener_flexibility(node, *item))
                # print(flexibilities)
                # stiffness = Stiffness.interplate_stiffness(flexibilities)
                stiffness2 = self.fastener_models[node.id].get_fastener_element(plate1_id, plate2_id).stiffness
                # print('Fastener stiffness comparison:', stiffness, stiffness2, stiffness == stiffness2)
                # elm_id = (node.id, plate1_id, plate2_id)
                # fastener_elm = FastenerElement(elm_id, stiffness2)
                # self.fastener_elements[fastener_elm.id] = fastener_elm
                fastener_stiffness_array.append(stiffness2)
        matrix = np.diag(fastener_stiffness_array)
        matrix_print(matrix, 'fastener_stiffness_matrix')
        return matrix

    def define_plate_and_fastener_combined_stiffness_matrix(self, plate_id: int) -> np.ndarray:
        plates_stiffness_array = []
        print('define_plate_and_fastener_combined_stiffness_matrix ****************** plate = ', plate_id)

        for i, node in enumerate(self.nodes[:-1]):
            next_node = self.nodes[i + 1]
            if not (plate_id in node.plate_ids and plate_id in next_node.plate_ids):
                plates_stiffness_array.append(0)
            else:
                # E = self.materials_db[node.plate(plate_id).material_id]['E']
                E = node.plate(plate_id).E
                area1 = node.plate(plate_id).area
                area2 = next_node.plate(plate_id).area
                t1 = node.plate(plate_id).thickness
                t2 = next_node.plate(plate_id).thickness
                coord1_x = node.coord_x
                coord2_x = next_node.coord_x
                coord_y = node.plate(plate_id).coord_y
                # area1 = w1 * t1
                # area2 = w2 * t2
                plate_elm = PlateElement(plate_id, node.id, next_node.id, E, area1, area2, t1, t2, coord1_x, coord2_x, coord_y)
                stiffness = plate_elm.stiffness
                self.plate_elements[plate_elm.id] = plate_elm
                plates_stiffness_array.append(stiffness)
                print('plates_stiffness_array = ', plates_stiffness_array)
        plates_stiffness_matrix = np.diag(plates_stiffness_array, 1) + \
                                  np.diag(plates_stiffness_array, -1) - \
                                  np.diag(plates_stiffness_array + [0]) - \
                                  np.diag([0] + plates_stiffness_array)

        fasteners_stiffness_matrix = np.zeros((self.nodes_qty, self.nodes_qty))
        for plt_id in self.plates_ids:
            if plt_id == plate_id:
                continue
            fasteners_stiffness_matrix += self.define_interplate_fastener_stiffness_matrix(plate_id, plt_id)

        combined_stiffness_matrix = plates_stiffness_matrix - fasteners_stiffness_matrix
        for i in range(self.nodes_qty):
            if combined_stiffness_matrix[i][i] == 0:
                combined_stiffness_matrix[i][i] = 1

        for condition in self.boundary_conditions.constraints:
            (bc_node_id, bc_plate_id, constraint) = condition
            # bc_node_id = boundary_condition.node_id
            bc_node_index = self.nodes_ids.index(bc_node_id)
            # bc_plate_id = boundary_condition.plate_id
            # For now, it's assumed that bc_constraint = 0

            if bc_plate_id == plate_id:
                combined_stiffness_matrix[bc_node_index][bc_node_index] = 1  # diagonal element
                if bc_node_index > 0:
                    combined_stiffness_matrix[bc_node_index - 1][bc_node_index] = 0  # above the diagonal element
                if bc_node_index < self.nodes_qty - 1:
                    combined_stiffness_matrix[bc_node_index + 1][bc_node_index] = 0  # below the diagonal element

        print('****************** define_plate_and_fastener_combined_stiffness_matrix plate = ', plate_id)
        return combined_stiffness_matrix

    def get_reactions(self):
        reactions = []
        for condition in self.boundary_conditions.constraints:
            (bc_node_id, bc_plate_id, constraint) = condition
            reaction_value = self.reactions_dict[(bc_node_id, bc_plate_id)]
            reactions.append((bc_node_id, bc_plate_id, reaction_value))
        return reactions

    def get_reactions_v2(self):
        reactions = []
        for gp in self.constrained_grid_points:
            for elm in self.plate_elements_v2:
                if gp.id in elm.id:
                    reaction_value = elm.get_load_at_grid_point_id(gp.id)
                    reactions.append((gp.node_id, gp.plate_id, reaction_value))
        return reactions

    def fasteners_loads_traffics_v2(self):
        fasteners_loads_traffics ={}
        for elm in self.fastener_elements_v2:
            gp1 = elm.grid_point1
            gp2 = elm.grid_point2
            node_id = gp1.node_id
            plate1_id = gp1.plate_id
            plate2_id = gp2.plate_id
            if node_id in fasteners_loads_traffics:
                loads_traffics = fasteners_loads_traffics[node_id]
            else:
                loads_traffics = []
                fasteners_loads_traffics[node_id] = loads_traffics
            lt_dict = {}
            lt_dict['plate1_id'] = plate1_id
            lt_dict['plate2_id'] = plate2_id
            lt_dict['load_traffic'] = elm.end_load
            loads_traffics.append(lt_dict)
        return fasteners_loads_traffics

    def set_elements_displacements(self):
        for plate_index in range(self.plates_qty):
            plate_id = self.plates_ids[plate_index]
            for node_index in range(self.nodes_qty - 1):
                node1 = self.nodes[node_index]
                node2 = self.nodes[node_index + 1]

                [node1_id, node2_id] = sorted([node1.id, node2.id])
                disp1 = self.displacements_dict[(node1_id, plate_id)]
                disp2 = self.displacements_dict[(node2_id, plate_id)]
                plate_elm_id = (plate_id, node1_id, node2_id)
                if plate_elm_id in self.plate_elements:
                    plate_elm = self.plate_elements[plate_elm_id]
                    plate_elm.set_displacements(node1.coord_x, disp1, node2.coord_x, disp2)

        for node_id in list(self.fastener_models):
            fastener_model = self.fastener_models[node_id]
            if fastener_model != None:
                fastener_model.set_displacements(self.displacements_dict)
        # for fastener_elm_id in list(self.fastener_elements):
        #     fastener_elm = self.fastener_elements[fastener_elm_id]
        #     (node_id, plate1_id, plate2_id) = fastener_elm.id
        #     node_index = self.nodes_ids.index(node_id)
        #     node = self.nodes[node_index]
        #     plate1_index = self.plates_ids.index(plate1_id)
        #     plate2_index = self.plates_ids.index(plate2_id)
        #     disp1_index = plate1_index * self.nodes_qty + node_index
        #     disp2_index = plate2_index * self.nodes_qty + node_index
        #     disp1 = self.displacement_vector[disp1_index]
        #     disp2 = self.displacement_vector[disp2_index]
        #     fastener_elm.set_displacements(node, disp1, disp2)

    def save_to_bdf(self):
        grid_points_qty = 0
        grid_points_dict = {}
        grid_points_strings = []
        plate_elements_strings = []
        fastener_elements_strings = []
        materials_strings = {}
        pbeam_strings = []
        cbeam_strings = []
        gp_index = 0
        elements_qty = 0
        for p_elm_id in list(self.plate_elements):
            p_elm = self.plate_elements[p_elm_id]
            [coord_x1, coord_x2] = p_elm.coords_x
            coord_y = p_elm.coord_y
            (plate_id, node1_id, node2_id) = p_elm.id
            grid_point1_id = int(coord_y + node1_id)
            if not grid_point1_id in grid_points_dict:
                grid_points_qty = grid_points_qty + 1
                gp1_index = grid_points_qty
                grid_points_dict[grid_point1_id] = (coord_x1 + 0.0, coord_y + 0.0, gp1_index)
            else:
                (x, y, gp1_index) = grid_points_dict[int(coord_y + node1_id)]

            grid_point2_id = int(coord_y + node2_id)
            if not grid_point2_id in grid_points_dict:
                grid_points_qty = grid_points_qty + 1
                gp2_index = grid_points_qty
                grid_points_dict[grid_point2_id] = (coord_x2 + 0.0, coord_y + 0.0, gp2_index)
            else:
                (x, y, gp2_index) = grid_points_dict[int(coord_y + node2_id)]

            elements_qty = elements_qty + 1
            # p_elm_string = define_celas2(elements_qty, p_elm.stiffness, grid_point2_id, 1, grid_point1_id, 1)
            material_id = plate_id
            property_id = elements_qty
            material_str = define_material(material_id, p_elm.E)
            materials_strings[material_id] = material_str
            pbeam_str = define_pbeam(property_id, material_id, p_elm.areas[0], p_elm.areas[1])
            cbeam_str = define_cbeam(elements_qty, property_id, grid_point1_id, grid_point2_id)
            pbeam_strings.append(pbeam_str)
            cbeam_strings.append(cbeam_str)
            # plate_elements_strings.append(p_elm_string)

        print('grid points:', list(grid_points_dict))
        for (grid_point_id) in list(grid_points_dict):
            (coord_x, coord_y, gp_index) = grid_points_dict[grid_point_id]
            coord_y = round(0.0 - coord_y / 1000, 1)
            gp_string = define_grid(grid_point_id, coord_x, coord_y, 0.0)
            grid_points_strings.append(gp_string)

        for f_model_node_id  in list(self.fastener_models):
            f_model = self.fastener_models[f_model_node_id]
            if f_model != None:
                for f_elm_id in list(f_model.fastener_elements):
                    f_elm = f_model.fastener_elements[f_elm_id]
                    [coord1_y, coord2_y] = f_elm.coords_y
                    grid_point1_id = int(coord1_y + f_model_node_id)
                    grid_point2_id = int(coord2_y + f_model_node_id)
                    stiffness = round(f_elm.stiffness, 1)
                    elements_qty = elements_qty + 1
                    f_elm_string = define_celas2(elements_qty, stiffness, grid_point1_id, 1, grid_point2_id, 1)
                    fastener_elements_strings.append(f_elm_string)

        bc = self.boundary_conditions
        bc_x_grid_points = []
        for item in bc.constraints:
            (node_id, plate_id, constraint) = item
            node_index = self.nodes_ids.index(node_id)
            node = self.nodes[node_index]
            plate = node.plate(plate_id)
            coord_y = plate.coord_y
            grid_point_id = int(coord_y + node_id)
            bc_x_grid_points.append(grid_point_id)
        print('bc_grid_points:', bc_x_grid_points)
        spc_set_id = 20
        spc_x_id = 200
        spc_yz_id = 250
        spc_set_string = short_format(['SPCADD', spc_set_id, spc_x_id, spc_yz_id])
        spc_constraints_string = define_spc_fixed_constraints(spc_x_id, bc_x_grid_points, 1) + '\n'
        gridpoints_list = sorted(list(grid_points_dict))
        gp1000 = [gp for gp in gridpoints_list if gp >=1000 and gp < 2000]
        gp2000 = [gp for gp in gridpoints_list if gp >= 2000 and gp < 3000]
        gp3000 = [gp for gp in gridpoints_list if gp >= 3000 and gp < 4000]
        gp4000 = [gp for gp in gridpoints_list if gp >= 4000 and gp < 5000]
        gp5000 = [gp for gp in gridpoints_list if gp >= 5000 and gp < 6000]
        bc_yz_grid_points = []
        if len(gp1000) > 0:
            bc_yz_grid_points.append(min(gp1000))
        if len(gp2000) > 0:
            bc_yz_grid_points.append(min(gp2000))
        if len(gp3000) > 0:
            bc_yz_grid_points.append(min(gp3000))
        if len(gp4000) > 0:
            bc_yz_grid_points.append(min(gp4000))
        if len(gp5000) > 0:
            bc_yz_grid_points.append(min(gp5000))
        spc_constraints_string += define_spc_fixed_constraints(spc_yz_id, bc_yz_grid_points, 23456)

        loads = self.loads
        forces_strings = []
        force_id = 300
        forces_ids = []
        print('loads len=', len(loads))
        for load in self.loads:
            node_id = load.node_id
            plate_id = load.plate_id
            node_index = self.nodes_ids.index(node_id)
            node = self.nodes[node_index]
            plate = node.plate(plate_id)
            coord_y = plate.coord_y
            grid_point_id = int(coord_y + node_id)
            force_id = force_id + 1
            forces_ids.append(force_id)
            forces_strings.append(define_force(force_id, grid_point_id, load.load_value + 0.0))

        load_set_id = 300
        load_set_string = define_load_set(load_set_id,forces_ids)

        bdf_file_string = ''
        header = [
            '$ Linear Static Analysis',
            'SOL 101',
            'CEND',
            'TITLE = JOLT_ANALYSIS',
            'ECHO = NONE',
            'SUBCASE 1',
            '   TITLE=JOLT_ANALYSIS',
            '   SPC = ' + str(spc_set_id),
            '   LOAD = ' + str(load_set_id),
            '   DISPLACEMENT(PRINT,SORT1,REAL)=ALL',
            '   SPCFORCES(PLOT,SORT1,REAL)=ALL',
            '   OLOAD(PLOT,SORT1,REAL)=ALL',
            '   GPFORCE=ALL',
            '   STRESS(PLOT,SORT1,REAL,VONMISES,BILIN)=ALL',
            '   FORCE(SORT1,REAL,BILIN)=ALL',
            'BEGIN BULK',
            'PARAM    POST    1',
            'PARAM    GRDPNT  0',
            'PARAM   PRTMAXIM YES'
        ]
        footer = 'ENDDATA'

        for item in header:
            print(item)
            bdf_file_string = bdf_file_string + item +'\n'

        for item in pbeam_strings:
            print(item)
            bdf_file_string = bdf_file_string + item +'\n'

        for item in cbeam_strings:
            print(item)
            bdf_file_string = bdf_file_string + item +'\n'

        for material_id in list(materials_strings):
            print(materials_strings[material_id])
            bdf_file_string = bdf_file_string + materials_strings[material_id] +'\n'

        # for item in plate_elements_strings:
        #     print(item)

        for item in fastener_elements_strings:
            print(item)
            bdf_file_string = bdf_file_string + item +'\n'

        for item in grid_points_strings:
            print(item)
            bdf_file_string = bdf_file_string + item +'\n'

        print(spc_set_string)
        bdf_file_string = bdf_file_string + spc_set_string +'\n'
        print(load_set_string)
        bdf_file_string = bdf_file_string + load_set_string +'\n'

        print(spc_constraints_string)
        bdf_file_string = bdf_file_string + spc_constraints_string +'\n'

        for item in forces_strings:
            print(item)
            bdf_file_string = bdf_file_string + item +'\n'

        print(footer)
        bdf_file_string = bdf_file_string + footer +'\n'
        try:
            f = open(PATH_DEBUG_FILE + 'joint_model.bdf', 'w')
            f.writelines(bdf_file_string)
            f.close()
        except FileNotFoundError:
            pass

    def plate_stiffnesses_summary(self):
        plate_stiffnesses = []
        for elm_id in list(self.plate_elements):
            plate_elm = self.plate_elements[elm_id]
            elm_data = {}
            (plate_id, node1_id, node2_id) = plate_elm.id
            elm_data['plate_id'] = plate_id
            elm_data['node1_id'] = node1_id
            elm_data['node2_id'] = node2_id
            elm_data['stiffness'] = plate_elm.stiffness
            elm_data['end_load'] = plate_elm.end_load
            plate_stiffnesses.append(elm_data)
        return plate_stiffnesses

    def plate_stiffnesses_summary_v2(self):
        plate_stiffnesses = []
        for plate_elm in self.plate_elements_v2:
            plate_id = plate_elm.grid_point1.plate_id
            node1_id = plate_elm.grid_point1.node_id
            node2_id = plate_elm.grid_point2.node_id
            elm_data = {}
            elm_data['plate_id'] = plate_id
            elm_data['node1_id'] = node1_id
            elm_data['node2_id'] = node2_id
            elm_data['stiffness'] = plate_elm.stiffness
            elm_data['end_load'] = plate_elm.end_load
            plate_stiffnesses.append(elm_data)
        return plate_stiffnesses

